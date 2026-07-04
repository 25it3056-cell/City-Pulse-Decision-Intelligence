# CityPulse API & Static Web Server in Native PowerShell
# Starts an HTTP Listener on http://localhost:3000

$port = 3000
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$port/")

try {
    $listener.Start()
} catch {
    Write-Host "Failed to start listener. Port $port may already be in use."
    Write-Host $_
    Exit
}

Write-Host "--------------------------------------------------------"
Write-Host " CityPulse Server started successfully!"
Write-Host " Listening on URL: http://localhost:$port/"
Write-Host " Press Ctrl+C in your terminal or stop the task to exit."
Write-Host "--------------------------------------------------------"

# Determine script folder
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
if ([string]::IsNullOrEmpty($scriptDir)) { 
    $scriptDir = Get-Location
}
$dataPath = Join-Path $scriptDir "data.json"

# Load initial state into memory
if (Test-Path $dataPath) {
    $dataJson = Get-Content -Raw -Path $dataPath -Encoding UTF8
    $state = ConvertFrom-Json $dataJson
} else {
    Write-Host "Warning: data.json not found! Server starting with empty state."
    $state = @{}
}

# Serve static files and handle API endpoints
while ($listener.IsListening) {
    try {
        $context = $listener.GetContext()
        $request = $context.Request
        $response = $context.Response
        
        # Standard CORS and caching headers
        $response.Headers.Add("Access-Control-Allow-Origin", "*")
        $response.Headers.Add("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        $response.Headers.Add("Access-Control-Allow-Headers", "Content-Type")
        $response.Headers.Add("Cache-Control", "no-store, no-cache, must-revalidate")
        
        if ($request.HttpMethod -eq "OPTIONS") {
            $response.StatusCode = 200
            $response.Close()
            continue
        }
        
        $urlPath = $request.Url.AbsolutePath
        
        # Static asset router
        if ($urlPath -eq "/" -or $urlPath -eq "/index.html") {
            $filePath = Join-Path $scriptDir "index.html"
            if (Test-Path $filePath) {
                $html = Get-Content -Raw -Path $filePath -Encoding UTF8
                $buffer = [System.Text.Encoding]::UTF8.GetBytes($html)
                $response.ContentType = "text/html; charset=utf-8"
                $response.ContentLength64 = $buffer.Length
                $response.OutputStream.Write($buffer, 0, $buffer.Length)
            } else {
                $response.StatusCode = 404
            }
        }
        elseif ($urlPath -eq "/style.css") {
            $filePath = Join-Path $scriptDir "style.css"
            if (Test-Path $filePath) {
                $css = Get-Content -Raw -Path $filePath -Encoding UTF8
                $buffer = [System.Text.Encoding]::UTF8.GetBytes($css)
                $response.ContentType = "text/css; charset=utf-8"
                $response.ContentLength64 = $buffer.Length
                $response.OutputStream.Write($buffer, 0, $buffer.Length)
            } else {
                $response.StatusCode = 404
            }
        }
        elseif ($urlPath -eq "/app.js") {
            $filePath = Join-Path $scriptDir "app.js"
            if (Test-Path $filePath) {
                $js = Get-Content -Raw -Path $filePath -Encoding UTF8
                $buffer = [System.Text.Encoding]::UTF8.GetBytes($js)
                $response.ContentType = "application/javascript; charset=utf-8"
                $response.ContentLength64 = $buffer.Length
                $response.OutputStream.Write($buffer, 0, $buffer.Length)
            } else {
                $response.StatusCode = 404
            }
        }
        elseif ($urlPath -eq "/data.json") {
            $jsonString = ConvertTo-Json $state -Depth 10
            $buffer = [System.Text.Encoding]::UTF8.GetBytes($jsonString)
            $response.ContentType = "application/json; charset=utf-8"
            $response.ContentLength64 = $buffer.Length
            $response.OutputStream.Write($buffer, 0, $buffer.Length)
        }
        # REST API GET endpoints
        elseif ($urlPath -eq "/api/hospitals" -and $request.HttpMethod -eq "GET") {
            $jsonString = ConvertTo-Json $state.hospitals -Depth 10
            $buffer = [System.Text.Encoding]::UTF8.GetBytes($jsonString)
            $response.ContentType = "application/json; charset=utf-8"
            $response.ContentLength64 = $buffer.Length
            $response.OutputStream.Write($buffer, 0, $buffer.Length)
        }
        elseif ($urlPath -eq "/api/outbreaks" -and $request.HttpMethod -eq "GET") {
            $jsonString = ConvertTo-Json $state.outbreaks -Depth 10
            $buffer = [System.Text.Encoding]::UTF8.GetBytes($jsonString)
            $response.ContentType = "application/json; charset=utf-8"
            $response.ContentLength64 = $buffer.Length
            $response.OutputStream.Write($buffer, 0, $buffer.Length)
        }
        elseif ($urlPath -eq "/api/sentiment" -and $request.HttpMethod -eq "GET") {
            $jsonString = ConvertTo-Json $state.sentiment -Depth 10
            $buffer = [System.Text.Encoding]::UTF8.GetBytes($jsonString)
            $response.ContentType = "application/json; charset=utf-8"
            $response.ContentLength64 = $buffer.Length
            $response.OutputStream.Write($buffer, 0, $buffer.Length)
        }
        # REST API POST endpoints
        elseif ($urlPath -eq "/api/simulate" -and $request.HttpMethod -eq "POST") {
            $reader = New-Object System.IO.StreamReader($request.InputStream)
            $body = $reader.ReadToEnd()
            $params = ConvertFrom-Json $body
            
            $humidity = 0.5
            if ($params.humidity -ne $null) { $humidity = [double]$params.humidity }
            $mobility = 1.0
            if ($params.mobility -ne $null) { $mobility = [double]$params.mobility }
            $temp = 22.0
            if ($params.temperature -ne $null) { $temp = [double]$params.temperature }
            
            # Simple outbreak simulation models
            $dengueVal = [Math]::Round(10 + ($humidity * 35) + (if ($temp -gt 25) { ($temp - 25) * 3 } else { 0 }))
            $fluVal = [Math]::Round(60 + ($mobility * 60) + (if ($temp -lt 20) { (20 - $temp) * 8 } else { 0 }))
            $gastroVal = [Math]::Round(40 + (if ($temp -gt 28) { ($temp - 28) * 6 } else { 0 }) + ($humidity * 20))
            
            # Update state in memory
            foreach ($d in $state.outbreaks.diseases) {
                if ($d.name -eq "Dengue") {
                    $d.currentCases = $dengueVal
                    $d.riskLevel = if ($dengueVal -gt 50) { "High" } elseif ($dengueVal -gt 25) { "Moderate" } else { "Low" }
                    $d.color = if ($dengueVal -gt 50) { "coral" } elseif ($dengueVal -gt 25) { "amber" } else { "emerald" }
                    $d.history = $d.history[1..($d.history.Length-1)] + @($dengueVal)
                }
                elseif ($d.name -eq "Influenza") {
                    $d.currentCases = $fluVal
                    $d.riskLevel = if ($fluVal -gt 150) { "High" } elseif ($fluVal -gt 95) { "Moderate" } else { "Low" }
                    $d.color = if ($fluVal -gt 150) { "coral" } elseif ($fluVal -gt 95) { "amber" } else { "emerald" }
                    $d.history = $d.history[1..($d.history.Length-1)] + @($fluVal)
                }
                elseif ($d.name -eq "Gastroenteritis") {
                    $d.currentCases = $gastroVal
                    $d.riskLevel = if ($gastroVal -gt 75) { "High" } elseif ($gastroVal -gt 50) { "Moderate" } else { "Low" }
                    $d.color = if ($gastroVal -gt 75) { "coral" } elseif ($gastroVal -gt 50) { "amber" } else { "emerald" }
                    $d.history = $d.history[1..($d.history.Length-1)] + @($gastroVal)
                }
            }
            
            $jsonString = ConvertTo-Json $state.outbreaks -Depth 10
            $buffer = [System.Text.Encoding]::UTF8.GetBytes($jsonString)
            $response.ContentType = "application/json; charset=utf-8"
            $response.ContentLength64 = $buffer.Length
            $response.OutputStream.Write($buffer, 0, $buffer.Length)
        }
        elseif ($urlPath -eq "/api/chat" -and $request.HttpMethod -eq "POST") {
            $reader = New-Object System.IO.StreamReader($request.InputStream)
            $body = $reader.ReadToEnd()
            $chatRequest = ConvertFrom-Json $body
            $msg = $chatRequest.message.ToLower().Trim()
            
            $reply = "I'm CityPulse AI. I can search hospital beds, check outbreaks, read sentiment reports, and simulate scenarios. Try typing: 'beds in Sector 3', 'check influenza risk', or 'go to maps'."
            $payload = @{ "reply" = $reply; "action" = $null; "target" = $null }
            
            # Simple keyword routing
            if ($msg -like "*bed*" -or $msg -like "*clinic*" -or $msg -like "*hospital*" -or $msg -like "*doctor*") {
                $targetSector = ""
                if ($msg -like "*sector 1*") { $targetSector = "Sector 1" }
                elseif ($msg -like "*sector 2*") { $targetSector = "Sector 2" }
                elseif ($msg -like "*sector 3*") { $targetSector = "Sector 3" }
                elseif ($msg -like "*sector 4*") { $targetSector = "Sector 4" }
                elseif ($msg -like "*sector 5*") { $targetSector = "Sector 5" }
                
                if ($targetSector -ne "") {
                    $matched = $state.hospitals | Where-Object { $_.sector -like "*$targetSector*" }
                    if ($matched) {
                        $reply = "Here's the report for $($targetSector): **$($matched.name)** currently has **$($matched.availableBeds)** free beds out of $($matched.totalBeds) total. There are $($matched.doctors) doctors active."
                        $payload.action = "navigate"
                        $payload.target = "dashboard"
                    }
                } else {
                    $reply = "We're tracking multiple facilities: **Metro General** (Sector 1) has 14 free beds, **St. Jude Clinic** (Sector 3) has 19, and **Beacon Health** (Sector 2) has 24. Where would you like to search?"
                    $payload.action = "navigate"
                    $payload.target = "dashboard"
                }
            }
            elseif ($msg -like "*dengue*" -or $msg -like "*outbreak*" -or $msg -like "*flu*" -or $msg -like "*cases*" -or $msg -like "*risk*") {
                $dengue = $state.outbreaks.diseases | Where-Object { $_.name -eq "Dengue" }
                $flu = $state.outbreaks.diseases | Where-Object { $_.name -eq "Influenza" }
                $reply = "Outbreak Alert Status: **Dengue** is showing a **$($dengue.riskLevel) Risk** with **$($dengue.currentCases) active cases** (up from $($dengue.previousCases)). **Influenza** is at **$($flu.riskLevel) Risk** with **$($flu.currentCases) active cases**. Go to the Predictions page to run environmental simulations."
                $payload.action = "navigate"
                $payload.target = "predictions"
            }
            elseif ($msg -like "*sentiment*" -or $msg -like "*feedback*" -or $msg -like "*citizen*" -or $msg -like "*poll*") {
                $reply = "Community satisfaction sits at **$($state.sentiment.score)% Positive** based on $($state.sentiment.totalFeedbacks) reports. Primary keywords: 'Wait time' (61 mentions), 'Friendly staff' (55 mentions). You can review public reviews in the Feedback section."
                $payload.action = "navigate"
                $payload.target = "feedback"
            }
            elseif ($msg -like "*map*" -or $msg -like "*location*" -or $msg -like "*where*") {
                $reply = "Switching to the Interactive Map interface. You will see markers for healthcare centers and glowing heat map zones for disease concerns."
                $payload.action = "navigate"
                $payload.target = "map"
            }
            elseif ($msg -like "*setting*" -or $msg -like "*theme*" -or $msg -like "*contrast*") {
                $reply = "Opening settings. You can adjust accessibility configuration, like screen reader helper text, font sizes, and contrast modes here."
                $payload.action = "navigate"
                $payload.target = "settings"
            }
            
            $payload.reply = $reply
            $jsonString = ConvertTo-Json $payload -Depth 10
            $buffer = [System.Text.Encoding]::UTF8.GetBytes($jsonString)
            $response.ContentType = "application/json; charset=utf-8"
            $response.ContentLength64 = $buffer.Length
            $response.OutputStream.Write($buffer, 0, $buffer.Length)
        }
        elseif ($urlPath -eq "/api/feedback" -and $request.HttpMethod -eq "POST") {
            $reader = New-Object System.IO.StreamReader($request.InputStream)
            $body = $reader.ReadToEnd()
            $newFeedback = ConvertFrom-Json $body
            
            $txt = $newFeedback.text.ToLower()
            $sent = "neutral"
            
            if ($txt -like "*good*" -or $txt -like "*great*" -or $txt -like "*excellent*" -or $txt -like "*nice*" -or $txt -like "*perfect*" -or $txt -like "*helpful*" -or $txt -like "*love*") {
                $sent = "positive"
                $state.sentiment.breakdown.positive += 1
            }
            elseif ($txt -like "*bad*" -or $txt -like "*slow*" -or $txt -like "*wait*" -or $txt -like "*crowded*" -or $txt -like "*hard*" -or $txt -like "*terrible*" -or $txt -like "*poor*") {
                $sent = "negative"
                $state.sentiment.breakdown.negative += 1
            } else {
                $state.sentiment.breakdown.neutral += 1
            }
            
            $state.sentiment.totalFeedbacks += 1
            
            $pos = $state.sentiment.breakdown.positive
            $neg = $state.sentiment.breakdown.negative
            $neu = $state.sentiment.breakdown.neutral
            $state.sentiment.score = [Math]::Round(($pos / ($pos + $neg + $neu)) * 100)
            
            $sec = "Sector 1"
            if ($newFeedback.sector) { $sec = $newFeedback.sector }
            $commentObj = [PSCustomObject]@{
                text = $newFeedback.text
                sentiment = $sent
                timestamp = "Just now"
                sector = $sec
            }
            $state.sentiment.comments = @($commentObj) + $state.sentiment.comments[0..3]
            
            $jsonString = ConvertTo-Json $state.sentiment -Depth 10
            $buffer = [System.Text.Encoding]::UTF8.GetBytes($jsonString)
            $response.ContentType = "application/json; charset=utf-8"
            $response.ContentLength64 = $buffer.Length
            $response.OutputStream.Write($buffer, 0, $buffer.Length)
        }
        elseif ($urlPath -eq "/api/book" -and $request.HttpMethod -eq "POST") {
            $reader = New-Object System.IO.StreamReader($request.InputStream)
            $body = $reader.ReadToEnd()
            $booking = ConvertFrom-Json $body
            
            $success = $false
            $msg = "Clinic not found"
            
            foreach ($h in $state.hospitals) {
                if ($h.id -eq $booking.hospitalId) {
                    if ($h.availableBeds -gt 0) {
                        $h.availableBeds -= 1
                        $h.appointments += 1
                        $success = $true
                        $msg = "Appointment booked successfully at $($h.name). 1 bed reserved."
                    } else {
                        $msg = "$($h.name) has no available beds remaining."
                    }
                    break
                }
            }
            
            $resPayload = @{ "success" = $success; "message" = $msg; "hospitals" = $state.hospitals }
            $jsonString = ConvertTo-Json $resPayload -Depth 10
            $buffer = [System.Text.Encoding]::UTF8.GetBytes($jsonString)
            $response.ContentType = "application/json; charset=utf-8"
            $response.ContentLength64 = $buffer.Length
            $response.OutputStream.Write($buffer, 0, $buffer.Length)
        }
        else {
            $response.StatusCode = 404
        }
        
        $response.Close()
    }
    catch {
        Write-Host "Error processing request: $_"
        if ($response) {
            $response.StatusCode = 500
            $response.Close()
        }
    }
}
