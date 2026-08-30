$ErrorActionPreference = "Stop"

$pluginRoot = if ($env:PLUGIN_ROOT) {
    $env:PLUGIN_ROOT
} else {
    (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
}
$entry = Join-Path $pluginRoot "dist\checker.mjs"

function Test-Runtime {
    param(
        [string]$Path,
        [bool]$Electron
    )

    if (-not $Path -or -not (Test-Path -LiteralPath $Path -PathType Leaf)) {
        return $false
    }

    $previous = $env:ELECTRON_RUN_AS_NODE
    try {
        if ($Electron) {
            $env:ELECTRON_RUN_AS_NODE = "1"
        } else {
            Remove-Item Env:ELECTRON_RUN_AS_NODE -ErrorAction SilentlyContinue
        }
        $major = & $Path -p "process.versions.node.split('.')[0]" 2>$null
        return $LASTEXITCODE -eq 0 -and $major -match '^\d+$' -and [int]$major -ge 20
    } catch {
        return $false
    } finally {
        if ($null -eq $previous) {
            Remove-Item Env:ELECTRON_RUN_AS_NODE -ErrorAction SilentlyContinue
        } else {
            $env:ELECTRON_RUN_AS_NODE = $previous
        }
    }
}

function Add-Candidate {
    param(
        [System.Collections.Generic.List[object]]$Candidates,
        [string]$Path,
        [bool]$Electron
    )

    if ($Path -and -not ($Candidates | Where-Object { $_.Path -eq $Path })) {
        $Candidates.Add([pscustomobject]@{ Path = $Path; Electron = $Electron })
    }
}

$candidates = [System.Collections.Generic.List[object]]::new()
Add-Candidate $candidates $env:DATABRICKS_METRIC_VIEW_NODE $false

if ($env:DATABRICKS_METRIC_VIEW_SKIP_SYSTEM_NODE -ne "1") {
    $pathNode = Get-Command node.exe -ErrorAction SilentlyContinue
    if ($pathNode) {
        Add-Candidate $candidates $pathNode.Source $false
    }
    Add-Candidate $candidates (Join-Path $env:ProgramFiles "nodejs\node.exe") $false
    Add-Candidate $candidates (Join-Path $env:LOCALAPPDATA "Programs\nodejs\node.exe") $false
    Add-Candidate $candidates (Join-Path $env:USERPROFILE ".volta\bin\node.exe") $false
}

Add-Candidate $candidates $env:DATABRICKS_METRIC_VIEW_HOST_RUNTIME $true

try {
    $current = Get-CimInstance Win32_Process -Filter "ProcessId=$PID"
    for ($depth = 0; $depth -lt 3 -and $current; $depth += 1) {
        $current = Get-CimInstance Win32_Process -Filter "ProcessId=$($current.ParentProcessId)"
        if ($current.ExecutablePath) {
            Add-Candidate $candidates $current.ExecutablePath $true
        }
    }
} catch {
    # Fixed install locations below remain available when process inspection is restricted.
}

if ($env:VSCODE_PID -match '^\d+$') {
    try {
        Add-Candidate $candidates (Get-Process -Id $env:VSCODE_PID -ErrorAction Stop).Path $true
    } catch {
        # Continue through other candidates.
    }
}

Add-Candidate $candidates (Join-Path $env:LOCALAPPDATA "Programs\Microsoft VS Code\Code.exe") $true
Add-Candidate $candidates (Join-Path $env:ProgramFiles "Microsoft VS Code\Code.exe") $true
if (${env:ProgramFiles(x86)}) {
    Add-Candidate $candidates (Join-Path ${env:ProgramFiles(x86)} "Microsoft VS Code\Code.exe") $true
}
Add-Candidate $candidates (Join-Path $env:LOCALAPPDATA "Programs\Microsoft VS Code Insiders\Code - Insiders.exe") $true
Add-Candidate $candidates (Join-Path $env:ProgramFiles "Microsoft VS Code Insiders\Code - Insiders.exe") $true

$selected = $null
foreach ($candidate in $candidates) {
    if (Test-Runtime $candidate.Path $candidate.Electron) {
        $selected = $candidate
        break
    }
}

if (-not $selected) {
    [Console]::Error.WriteLine("databricks-metric-view: could not find the host's bundled Node runtime or Node.js 20+")
    exit 127
}

if ($selected.Electron) {
    $env:ELECTRON_RUN_AS_NODE = "1"
} else {
    Remove-Item Env:ELECTRON_RUN_AS_NODE -ErrorAction SilentlyContinue
}

& $selected.Path $entry @args
exit $LASTEXITCODE
