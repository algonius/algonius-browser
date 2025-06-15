# Debug script to test extension ID validation
param([string]$TestId = "fgdfhaoklbjodbnhahlobkfiafbjfmfj")

Write-Host "Testing Extension ID: $TestId" -ForegroundColor Yellow
Write-Host "Length: $($TestId.Length)" -ForegroundColor Cyan

# Test regex patterns individually
Write-Host "`nTesting regex patterns:" -ForegroundColor Green

# Pattern 1: Just 32 character ID
$pattern1 = "^[a-z0-9]{32}$"
$match1 = $TestId -match $pattern1
Write-Host "Pattern 1 (32 chars): $pattern1 -> $match1" -ForegroundColor $(if($match1){"Green"}else{"Red"})

# Pattern 2: Full chrome-extension format
$fullId = "chrome-extension://$TestId/"
$pattern2 = "^chrome-extension://[a-z0-9]{32}/$"
$match2 = $fullId -match $pattern2
Write-Host "Pattern 2 (full format): $pattern2 -> $match2" -ForegroundColor $(if($match2){"Green"}else{"Red"})
Write-Host "Full ID: $fullId" -ForegroundColor Cyan

# Test character validation
Write-Host "`nCharacter analysis:" -ForegroundColor Green
$chars = $TestId.ToCharArray()
$invalidChars = @()
foreach ($char in $chars) {
    if ($char -notmatch '[a-z0-9]') {
        $invalidChars += $char
    }
}

if ($invalidChars.Count -eq 0) {
    Write-Host "All characters are valid (a-z, 0-9)" -ForegroundColor Green
} else {
    Write-Host "Invalid characters found: $($invalidChars -join ', ')" -ForegroundColor Red
}

# Test the ConvertFrom-ExtensionIds function logic
Write-Host "`nTesting ConvertFrom-ExtensionIds logic:" -ForegroundColor Green

function Test-ExtensionId {
    param([string]$Id)
    return $Id -match "^chrome-extension://[a-z0-9]{32}/$"
}

function ConvertFrom-ExtensionIds {
    param([string]$Input)
    
    $ids = @()
    $rawIds = $Input -split "," | ForEach-Object { $_.Trim() }
    
    foreach ($rawId in $rawIds) {
        if ([string]::IsNullOrWhiteSpace($rawId)) {
            continue
        }
        
        $trimmedId = $rawId.Trim()
        Write-Host "Processing: '$trimmedId'" -ForegroundColor Cyan
        
        # Auto-format extension ID if it's just the 32-character ID
        if ($trimmedId -match "^[a-z0-9]{32}$") {
            Write-Host "  Matches 32-char pattern, converting to full format" -ForegroundColor Yellow
            $trimmedId = "chrome-extension://$trimmedId/"
        }
        elseif ($trimmedId -match "^chrome-extension://[a-z0-9]{32}$") {
            Write-Host "  Missing trailing slash, adding it" -ForegroundColor Yellow
            $trimmedId = "$trimmedId/"
        }
        elseif ($trimmedId -notmatch "^chrome-extension://") {
            Write-Host "  Doesn't start with chrome-extension://" -ForegroundColor Yellow
            if ($trimmedId -match "^[a-z0-9]{32}/?$") {
                $cleanId = $trimmedId -replace "/$", ""
                $trimmedId = "chrome-extension://$cleanId/"
                Write-Host "  Converted to: '$trimmedId'" -ForegroundColor Yellow
            }
        }
        
        # Ensure trailing slash
        if ($trimmedId -match "^chrome-extension://" -and $trimmedId -notmatch "/$") {
            $trimmedId = "$trimmedId/"
            Write-Host "  Added trailing slash: '$trimmedId'" -ForegroundColor Yellow
        }
        
        Write-Host "  Final format: '$trimmedId'" -ForegroundColor Cyan
        
        # Validate format
        if (Test-ExtensionId $trimmedId) {
            Write-Host "  ✅ VALID" -ForegroundColor Green
            $ids += $trimmedId
        }
        else {
            Write-Host "  ❌ INVALID" -ForegroundColor Red
            Write-Host "  Expected: 32 lowercase characters and numbers or full chrome-extension://id/ format" -ForegroundColor Red
        }
    }
    
    Write-Host "Total valid IDs found: $($ids.Count)" -ForegroundColor $(if($ids.Count -gt 0){"Green"}else{"Red"})
    return $ids
}

# Test the conversion
$result = ConvertFrom-ExtensionIds $TestId
Write-Host "`nFinal result: $($result -join ', ')" -ForegroundColor $(if($result.Count -gt 0){"Green"}else{"Red"})
