param(
  [ValidateSet('help', 'status', 'install', 'dev', 'desktop', 'auto', 'build', 'deploy')]
  [string]$Action = 'help',

  [ValidateSet('none', 'netlify', 'vercel')]
  [string]$FrontendTarget = 'none',

  [ValidateSet('none', 'render')]
  [string]$BackendTarget = 'render',

  [switch]$UseCli,
  [switch]$SkipInstall
)

$ErrorActionPreference = 'Stop'

$RootDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$BackendDir = Join-Path $RootDir 'backend'
$FrontendNodeModules = Join-Path $RootDir 'node_modules'
$BackendNodeModules = Join-Path $BackendDir 'node_modules'
$FrontendBuildDir = Join-Path $RootDir 'build'
$FrontendEnvFile = Join-Path $RootDir '.env'
$BackendEnvFile = Join-Path $BackendDir '.env'

function Write-Section {
  param([string]$Text)
  Write-Host ''
  Write-Host "== $Text ==" -ForegroundColor Cyan
}

function Write-StatusLine {
  param(
    [string]$Label,
    [ValidateSet('ok', 'warn', 'error', 'info')]
    [string]$State,
    [string]$Message
  )

  $prefix = switch ($State) {
    'ok' { '[OK]' }
    'warn' { '[WARN]' }
    'error' { '[FAIL]' }
    default { '[INFO]' }
  }

  $color = switch ($State) {
    'ok' { 'Green' }
    'warn' { 'Yellow' }
    'error' { 'Red' }
    default { 'Gray' }
  }

  Write-Host ("{0} {1}: {2}" -f $prefix, $Label, $Message) -ForegroundColor $color
}

function Invoke-CheckedCommand {
  param(
    [string]$Label,
    [string]$WorkingDirectory,
    [string]$Executable,
    [string[]]$ArgumentList = @()
  )

  Write-Host "-> $Label" -ForegroundColor Yellow
  $resolvedExecutable = $null
  foreach ($candidate in @("$Executable.cmd", "$Executable.exe", $Executable)) {
    try {
      $resolvedExecutable = (Get-Command $candidate -ErrorAction Stop).Source
      break
    } catch {
    }
  }

  if (-not $resolvedExecutable) {
    throw "No se encontro el ejecutable '$Executable'."
  }

  $process = Start-Process `
    -FilePath $resolvedExecutable `
    -ArgumentList $ArgumentList `
    -WorkingDirectory $WorkingDirectory `
    -NoNewWindow `
    -Wait `
    -PassThru

  if ($process.ExitCode -ne 0) {
    throw "Fallo '$Label' con codigo $($process.ExitCode)."
  }
}

function Test-DependenciesInstalled {
  return (Test-Path $FrontendNodeModules) -and (Test-Path $BackendNodeModules)
}

function Install-Dependencies {
  Write-Section 'Instalando dependencias'
  Invoke-CheckedCommand -Label 'npm install (frontend)' -WorkingDirectory $RootDir -Executable 'npm' -ArgumentList @('install')
  Invoke-CheckedCommand -Label 'npm install (backend)' -WorkingDirectory $BackendDir -Executable 'npm' -ArgumentList @('install')
}

function Ensure-Dependencies {
  if ($SkipInstall) {
    return
  }

  if (-not (Test-DependenciesInstalled)) {
    Install-Dependencies
    return
  }

  Write-Host 'Dependencias ya instaladas.' -ForegroundColor Green
}

function Get-EscapedPowerShellLiteral {
  param([string]$Value)
  return $Value.Replace("'", "''")
}

function Get-EnvKeys {
  param([string]$Path)

  if (-not (Test-Path $Path)) {
    return @()
  }

  return Get-Content $Path |
    ForEach-Object { $_.Trim() } |
    Where-Object { $_ -and -not $_.StartsWith('#') -and $_ -match '^[A-Za-z_][A-Za-z0-9_]*=' } |
    ForEach-Object { ($_ -split '=', 2)[0].Trim() }
}

function Test-PortListening {
  param([int]$Port)

  $netTcp = Get-Command Get-NetTCPConnection -ErrorAction SilentlyContinue
  if ($netTcp) {
    $listeners = Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction SilentlyContinue
    return @($listeners).Count -gt 0
  }

  $matches = netstat -ano | Select-String -Pattern "LISTENING\s+\S*:$Port\s"
  return @($matches).Count -gt 0
}

function Get-PortProcessInfo {
  param([int]$Port)

  $netTcp = Get-Command Get-NetTCPConnection -ErrorAction SilentlyContinue
  if ($netTcp) {
    $connection = Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction SilentlyContinue |
      Select-Object -First 1

    if ($connection) {
      $process = Get-Process -Id $connection.OwningProcess -ErrorAction SilentlyContinue
      return [pscustomobject]@{
        Port = $Port
        Pid = $connection.OwningProcess
        Name = if ($process) { $process.ProcessName } else { 'Desconocido' }
      }
    }

    return $null
  }

  $line = netstat -ano | Select-String -Pattern "LISTENING\s+\S*:$Port\s" | Select-Object -First 1
  if (-not $line) {
    return $null
  }

  $parts = ($line.ToString() -replace '\s+', ' ').Trim().Split(' ')
  $pid = $parts[-1]
  $process = Get-Process -Id $pid -ErrorAction SilentlyContinue

  return [pscustomobject]@{
    Port = $Port
    Pid = $pid
    Name = if ($process) { $process.ProcessName } else { 'Desconocido' }
  }
}

function Stop-ListeningNodeProcess {
  param([int]$Port)

  $portProcess = Get-PortProcessInfo -Port $Port
  if (-not $portProcess) {
    return $false
  }

  if ($portProcess.Name -ne 'node') {
    throw "El puerto $Port esta en uso por '$($portProcess.Name)' (PID $($portProcess.Pid)). No se cerrara automaticamente."
  }

  Write-Host "Liberando puerto $Port cerrando node (PID $($portProcess.Pid))..." -ForegroundColor Yellow
  Stop-Process -Id $portProcess.Pid -Force -ErrorAction Stop
  Start-Sleep -Seconds 2
  return $true
}

function Get-SystemStatus {
  $npmCommand = Get-Command npm -ErrorAction SilentlyContinue
  $nodeCommand = Get-Command node -ErrorAction SilentlyContinue
  $frontendEnvExists = Test-Path $FrontendEnvFile
  $backendEnvExists = Test-Path $BackendEnvFile
  $frontendEnvKeys = if ($frontendEnvExists) { Get-EnvKeys -Path $FrontendEnvFile } else { @() }
  $backendEnvKeys = if ($backendEnvExists) { Get-EnvKeys -Path $BackendEnvFile } else { @() }
  $requiredBackendKeys = @('MONGODB_URI', 'JWT_SECRET')
  $missingBackendKeys = $requiredBackendKeys | Where-Object { $_ -notin $backendEnvKeys }

  return [pscustomobject]@{
    NodeCommand            = $nodeCommand
    NpmCommand             = $npmCommand
    FrontendEnvExists      = $frontendEnvExists
    FrontendEnvKeys        = $frontendEnvKeys
    BackendEnvExists       = $backendEnvExists
    BackendEnvKeys         = $backendEnvKeys
    RequiredBackendKeys    = $requiredBackendKeys
    MissingBackendKeys     = $missingBackendKeys
    FrontendDepsInstalled  = Test-Path $FrontendNodeModules
    BackendDepsInstalled   = Test-Path $BackendNodeModules
    BuildExists            = Test-Path $FrontendBuildDir
    NetlifyConfigExists    = Test-Path (Join-Path $RootDir 'netlify.toml')
    VercelConfigExists     = Test-Path (Join-Path $RootDir 'vercel.json')
    RenderConfigExists     = Test-Path (Join-Path $BackendDir 'render.yaml')
    Port3000InUse          = Test-PortListening -Port 3000
    Port5000InUse          = Test-PortListening -Port 5000
    Port3000Process        = Get-PortProcessInfo -Port 3000
    Port5000Process        = Get-PortProcessInfo -Port 5000
  }
}

function Show-Status {
  param(
    [pscustomobject]$Status = $null
  )

  if (-not $Status) {
    $Status = Get-SystemStatus
  }

  Write-Section 'Estado del sistema'

  if ($Status.NodeCommand) {
    Write-StatusLine -Label 'Node.js' -State 'ok' -Message $Status.NodeCommand.Source
  } else {
    Write-StatusLine -Label 'Node.js' -State 'error' -Message 'No encontrado en PATH.'
  }

  if ($Status.NpmCommand) {
    Write-StatusLine -Label 'npm' -State 'ok' -Message $Status.NpmCommand.Source
  } else {
    Write-StatusLine -Label 'npm' -State 'error' -Message 'No encontrado en PATH.'
  }

  if ($Status.FrontendEnvExists) {
    if ($Status.FrontendEnvKeys.Count -gt 0) {
      Write-StatusLine -Label 'Frontend .env' -State 'ok' -Message ("Archivo presente. Claves: {0}" -f ($Status.FrontendEnvKeys -join ', '))
    } else {
      Write-StatusLine -Label 'Frontend .env' -State 'warn' -Message 'Archivo presente, pero sin claves detectadas. Es opcional.'
    }
  } else {
    Write-StatusLine -Label 'Frontend .env' -State 'info' -Message 'No existe. El frontend puede funcionar con los valores por defecto.'
  }

  if ($Status.BackendEnvExists) {
    if ($Status.MissingBackendKeys.Count -eq 0) {
      Write-StatusLine -Label 'Backend .env' -State 'ok' -Message ("Archivo presente. Claves requeridas detectadas: {0}" -f ($Status.RequiredBackendKeys -join ', '))
    } else {
      Write-StatusLine -Label 'Backend .env' -State 'error' -Message ("Faltan claves requeridas: {0}" -f ($Status.MissingBackendKeys -join ', '))
    }
  } else {
    Write-StatusLine -Label 'Backend .env' -State 'error' -Message 'No existe. El backend no arrancara correctamente sin este archivo.'
  }

  if ($Status.FrontendDepsInstalled) {
    Write-StatusLine -Label 'Dependencias frontend' -State 'ok' -Message 'Instaladas.'
  } else {
    Write-StatusLine -Label 'Dependencias frontend' -State 'warn' -Message 'Faltan. Ejecuta .\sistema.ps1 install'
  }

  if ($Status.BackendDepsInstalled) {
    Write-StatusLine -Label 'Dependencias backend' -State 'ok' -Message 'Instaladas.'
  } else {
    Write-StatusLine -Label 'Dependencias backend' -State 'warn' -Message 'Faltan. Ejecuta .\sistema.ps1 install'
  }

  if ($Status.BuildExists) {
    Write-StatusLine -Label 'Build frontend' -State 'ok' -Message 'Existe una compilacion lista.'
  } else {
    Write-StatusLine -Label 'Build frontend' -State 'info' -Message 'No existe build todavia. Usa .\sistema.ps1 build'
  }

  if ($Status.NetlifyConfigExists) {
    Write-StatusLine -Label 'Netlify' -State 'ok' -Message 'Configuracion presente.'
  } else {
    Write-StatusLine -Label 'Netlify' -State 'info' -Message 'Sin configuracion.'
  }

  if ($Status.VercelConfigExists) {
    Write-StatusLine -Label 'Vercel' -State 'ok' -Message 'Configuracion presente.'
  } else {
    Write-StatusLine -Label 'Vercel' -State 'info' -Message 'Sin configuracion.'
  }

  if ($Status.RenderConfigExists) {
    Write-StatusLine -Label 'Render' -State 'ok' -Message 'Configuracion presente.'
  } else {
    Write-StatusLine -Label 'Render' -State 'info' -Message 'Sin configuracion.'
  }

  if ($Status.Port3000InUse) {
    $message3000 = 'En uso.'
    if ($Status.Port3000Process) {
      $message3000 = "En uso por $($Status.Port3000Process.Name) (PID $($Status.Port3000Process.Pid))."
    }
    Write-StatusLine -Label 'Puerto 3000' -State 'warn' -Message $message3000
  } else {
    Write-StatusLine -Label 'Puerto 3000' -State 'ok' -Message 'Libre.'
  }

  if ($Status.Port5000InUse) {
    $message5000 = 'En uso.'
    if ($Status.Port5000Process) {
      $message5000 = "En uso por $($Status.Port5000Process.Name) (PID $($Status.Port5000Process.Pid))."
    }
    Write-StatusLine -Label 'Puerto 5000' -State 'warn' -Message $message5000
  } else {
    Write-StatusLine -Label 'Puerto 5000' -State 'ok' -Message 'Libre.'
  }
}

function Get-InteractiveModeBlockers {
  param(
    [pscustomobject]$Status
  )

  $blockers = @()

  if (-not $Status.NodeCommand) {
    $blockers += 'Node.js no esta disponible en PATH.'
  }

  if (-not $Status.NpmCommand) {
    $blockers += 'npm no esta disponible en PATH.'
  }

  if (-not $Status.BackendEnvExists) {
    $blockers += 'Falta backend\.env.'
  } elseif ($Status.MissingBackendKeys.Count -gt 0) {
    $blockers += "Faltan claves en backend\.env: $($Status.MissingBackendKeys -join ', ')"
  }

  if ($SkipInstall -and -not $Status.FrontendDepsInstalled) {
    $blockers += 'Faltan dependencias del frontend y se indico -SkipInstall.'
  }

  if ($SkipInstall -and -not $Status.BackendDepsInstalled) {
    $blockers += 'Faltan dependencias del backend y se indico -SkipInstall.'
  }

  if ($Status.Port3000InUse) {
    $blockers += 'El puerto 3000 ya esta en uso.'
  }

  if ($Status.Port5000InUse) {
    $blockers += 'El puerto 5000 ya esta en uso.'
  }

  return $blockers
}

function Invoke-InteractivePreflight {
  param(
    [string]$Mode
  )

  Write-Section "Prevalidacion para $Mode"
  $status = Get-SystemStatus
  Show-Status -Status $status

  $blockers = Get-InteractiveModeBlockers -Status $status
  if ($blockers.Count -gt 0) {
    Write-Host ''
    Write-Host "No se puede iniciar '$Mode' todavia." -ForegroundColor Red
    $blockers | ForEach-Object {
      Write-Host " - $_" -ForegroundColor Red
    }
    throw "Prevalidacion fallida para '$Mode'."
  }

  Write-Host ''
  Write-Host "Prevalidacion correcta. Continuando con '$Mode'..." -ForegroundColor Green
}

function Start-WindowCommand {
  param(
    [string]$Title,
    [string]$WorkingDirectory,
    [string]$CommandBlock
  )

  $safeTitle = Get-EscapedPowerShellLiteral $Title
  $safeDir = Get-EscapedPowerShellLiteral $WorkingDirectory
  $fullCommand = @(
    '$Host.UI.RawUI.WindowTitle = '''
    $safeTitle
    ''';'
    'Set-Location -LiteralPath '''
    $safeDir
    ''';'
    $CommandBlock
  ) -join ' '

  Start-Process powershell `
    -ArgumentList @(
      '-NoExit',
      '-NoProfile',
      '-ExecutionPolicy',
      'Bypass',
      '-Command',
      $fullCommand
    ) | Out-Null
}

function Show-Help {
  Write-Host ''
  Write-Host 'Sistema TBY - Script unico' -ForegroundColor Green
  Write-Host ''
  Write-Host 'Uso:'
  Write-Host '  .\sistema.ps1 help'
  Write-Host '  .\sistema.ps1 status'
  Write-Host '  .\sistema.ps1 install'
  Write-Host '  .\sistema.ps1 dev'
  Write-Host '  .\sistema.ps1 desktop'
  Write-Host '  .\sistema.ps1 auto'
  Write-Host '  .\sistema.ps1 build'
  Write-Host '  .\sistema.ps1 deploy -FrontendTarget netlify'
  Write-Host ''
  Write-Host 'Acciones:'
  Write-Host '  help     Muestra esta ayuda.'
  Write-Host '  status   Revisa entorno, .env, dependencias, build y puertos.'
  Write-Host '  install  Instala frontend y backend.'
  Write-Host '  dev      Abre backend y frontend en ventanas separadas.'
  Write-Host '  desktop  Abre backend, frontend y Electron.'
  Write-Host '  auto     Libera puertos node si hace falta, instala y abre el sistema.'
  Write-Host '  build    Compila frontend y valida backend.'
  Write-Host '  deploy   Prepara despliegue y opcionalmente usa CLI de frontend.'
  Write-Host ''
  Write-Host 'Opciones:'
  Write-Host '  -SkipInstall            No reinstala dependencias si faltan.'
  Write-Host '  -FrontendTarget none|netlify|vercel'
  Write-Host '  -BackendTarget none|render'
  Write-Host '  -UseCli                 Si existe CLI compatible, intenta publicacion del frontend.'
  Write-Host ''
  Write-Host 'Tambien puedes usar:'
  Write-Host '  npm run system:status'
  Write-Host '  npm run system:install'
  Write-Host '  npm run system:dev'
  Write-Host '  npm run system:desktop'
  Write-Host '  npm run system:auto'
  Write-Host '  npm run system:build'
  Write-Host '  npm run system:deploy'
}

function Start-DevMode {
  Invoke-InteractivePreflight -Mode 'dev'
  Ensure-Dependencies
  Write-Section 'Arranque en desarrollo'
  Start-WindowCommand -Title 'TBY Backend' -WorkingDirectory $BackendDir -CommandBlock 'npm run dev'
  Start-WindowCommand -Title 'TBY Frontend' -WorkingDirectory $RootDir -CommandBlock 'npm start'
  Write-Host 'Backend y frontend iniciados en ventanas separadas.' -ForegroundColor Green
  Write-Host 'Frontend esperado: http://localhost:3000'
  Write-Host 'Backend esperado:  http://localhost:5000'
}

function Start-DesktopMode {
  Invoke-InteractivePreflight -Mode 'desktop'
  Ensure-Dependencies
  Write-Section 'Arranque desktop'
  Start-WindowCommand -Title 'TBY Backend' -WorkingDirectory $BackendDir -CommandBlock 'npm run dev'
  Start-WindowCommand -Title 'TBY Frontend' -WorkingDirectory $RootDir -CommandBlock 'npm start'
  Start-WindowCommand -Title 'TBY Electron' -WorkingDirectory $RootDir -CommandBlock '$env:ELECTRON_IS_DEV = ''1''; npm run electron-dev'
  Write-Host 'Backend, frontend y Electron iniciados.' -ForegroundColor Green
}

function Start-AutoMode {
  Write-Section 'Inicio automatico'
  $status = Get-SystemStatus
  Show-Status -Status $status

  if (-not $status.BackendEnvExists) {
    throw 'Falta backend\.env. Completa ese archivo antes de iniciar automaticamente.'
  }

  if ($status.MissingBackendKeys.Count -gt 0) {
    throw "Faltan claves en backend\.env: $($status.MissingBackendKeys -join ', ')"
  }

  if ($status.Port3000InUse) {
    Stop-ListeningNodeProcess -Port 3000 | Out-Null
  }

  if ($status.Port5000InUse) {
    Stop-ListeningNodeProcess -Port 5000 | Out-Null
  }

  Start-DesktopMode
}

function Test-BackendSyntax {
  Write-Section 'Validando backend'
  Invoke-CheckedCommand -Label 'node --check server.js' -WorkingDirectory $BackendDir -Executable 'node' -ArgumentList @('--check', 'server.js')

  Get-ChildItem -Path (Join-Path $BackendDir 'routes') -Filter '*.js' | ForEach-Object {
    Invoke-CheckedCommand -Label "node --check $($_.Name)" -WorkingDirectory $BackendDir -Executable 'node' -ArgumentList @('--check', $_.FullName)
  }
}

function Build-System {
  Ensure-Dependencies
  Write-Section 'Build del sistema'
  Invoke-CheckedCommand -Label 'npm run build' -WorkingDirectory $RootDir -Executable 'npm' -ArgumentList @('run', 'build')
  Test-BackendSyntax
  Write-Host "Frontend compilado en: $FrontendBuildDir" -ForegroundColor Green
}

function Invoke-OptionalFrontendDeploy {
  if (-not $UseCli -or $FrontendTarget -eq 'none') {
    return
  }

  switch ($FrontendTarget) {
    'netlify' {
      $command = Get-Command netlify -ErrorAction SilentlyContinue
      if (-not $command) {
        Write-Warning 'No se encontro la CLI de Netlify. Se deja solo el build listo.'
        return
      }
      Invoke-CheckedCommand -Label 'netlify deploy --prod --dir build' -WorkingDirectory $RootDir -Executable 'netlify' -ArgumentList @('deploy', '--prod', '--dir', 'build')
    }
    'vercel' {
      $command = Get-Command vercel -ErrorAction SilentlyContinue
      if (-not $command) {
        Write-Warning 'No se encontro la CLI de Vercel. Se deja solo el build listo.'
        return
      }
      Invoke-CheckedCommand -Label 'vercel --prod' -WorkingDirectory $RootDir -Executable 'vercel' -ArgumentList @('--prod')
    }
  }
}

function Show-DeploySummary {
  Write-Section 'Resumen de despliegue'
  Write-Host "Frontend listo: $FrontendBuildDir"

  switch ($FrontendTarget) {
    'netlify' {
      if (-not $UseCli) {
        Write-Host 'Frontend target: Netlify (sube la carpeta build o conecta este repo).'
      }
    }
    'vercel' {
      if (-not $UseCli) {
        Write-Host 'Frontend target: Vercel (usa la raiz del proyecto y vercel.json).'
      }
    }
  }

  switch ($BackendTarget) {
    'render' {
      Write-Host "Backend target: Render usando $BackendDir\render.yaml"
      Write-Host 'Si despliegas manualmente, publica la carpeta backend como servicio Node.'
    }
    'none' {
      Write-Host 'Backend target: ninguno.'
    }
  }
}

switch ($Action) {
  'help' {
    Show-Help
  }
  'status' {
    Show-Status
  }
  'install' {
    Install-Dependencies
  }
  'dev' {
    Start-DevMode
  }
  'desktop' {
    Start-DesktopMode
  }
  'auto' {
    Start-AutoMode
  }
  'build' {
    Build-System
  }
  'deploy' {
    Build-System
    Invoke-OptionalFrontendDeploy
    Show-DeploySummary
  }
}
