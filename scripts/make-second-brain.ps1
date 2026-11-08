<#
.SYNOPSIS
  Creates a "second brain" (Markdown knowledge vault) folder structure.

.DESCRIPTION
  Idempotent: existing files are never overwritten unless -Force is given.
  Works with Windows PowerShell 5.1 and PowerShell 7+. Vault is plain Markdown,
  so it opens directly in Obsidian, VS Code, or any editor.

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File .\make-second-brain.ps1
  powershell -ExecutionPolicy Bypass -File .\make-second-brain.ps1 -Root D:\Brain -Force
#>
[CmdletBinding()]
param(
  [string]$Root = 'C:\YIGIT-SHARED-BRAIN\second-brain',
  [switch]$Force,
  [switch]$GitInit
)

$ErrorActionPreference = 'Stop'
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
$today = Get-Date -Format 'yyyy-MM-dd'

function Write-Note {
  param([string]$RelPath, [string]$Content)
  $full = Join-Path $Root $RelPath
  $dir = Split-Path $full -Parent
  if (-not (Test-Path -LiteralPath $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
  if ((Test-Path -LiteralPath $full) -and -not $Force) {
    Write-Host "  skip   $RelPath (exists)" -ForegroundColor DarkGray
    return
  }
  [System.IO.File]::WriteAllText($full, $Content.Replace("`r`n", "`n"), $utf8NoBom)
  Write-Host "  write  $RelPath" -ForegroundColor Green
}

Write-Host "Second brain -> $Root" -ForegroundColor Cyan

# ---- Folder structure (PARA + inbox/journal/templates) ----
$folders = @(
  '00-Inbox',
  '01-Projects',
  '02-Areas',
  '03-Resources',
  '04-Archive',
  '05-Journal\daily',
  '05-Journal\weekly',
  '06-Notes\permanent',
  '06-Notes\literature',
  '07-People',
  '08-AI-Context',
  '09-Attachments',
  '_templates'
)
foreach ($f in $folders) {
  $p = Join-Path $Root $f
  if (-not (Test-Path -LiteralPath $p)) {
    New-Item -ItemType Directory -Path $p -Force | Out-Null
    Write-Host "  mkdir  $f" -ForegroundColor Green
  }
}

# ---- Top-level docs ----
Write-Note 'README.md' @"
# Second Brain

Plain-Markdown knowledge vault. Created $today.

## Structure
| Folder | Purpose |
|---|---|
| 00-Inbox | Quick capture. Empty it weekly. |
| 01-Projects | Active efforts with a goal and an end. |
| 02-Areas | Ongoing responsibilities (no end date). |
| 03-Resources | Reference material by topic. |
| 04-Archive | Finished or inactive items. |
| 05-Journal | Daily and weekly notes. |
| 06-Notes | Permanent (own words) and literature (sources) notes. |
| 07-People | One note per person. |
| 08-AI-Context | Context files to paste/feed into AI assistants. |
| 09-Attachments | Images, PDFs, files. |
| _templates | Note templates. |

## Workflow
1. Capture everything in **00-Inbox** (or today's daily note).
2. Weekly review: move inbox items to Projects / Areas / Resources / Notes.
3. Write permanent notes in your own words; link them with [[wikilinks]].
4. Keep durable facts about you and your projects in **08-AI-Context** so any AI tool can load them.

Open this folder as a vault in Obsidian, or just use any editor.
"@

Write-Note '00-Inbox\README.md' "# Inbox`n`nDrop raw captures here. Process weekly.`n"
Write-Note '01-Projects\README.md' "# Projects`n`nOne folder or note per project. Use the project template.`n"
Write-Note '02-Areas\README.md' "# Areas`n`nHealth, Finance, Career, Learning, Home... ongoing responsibilities.`n"
Write-Note '03-Resources\README.md' "# Resources`n`nTopic-based reference material.`n"
Write-Note '04-Archive\README.md' "# Archive`n`nMove finished projects and stale notes here.`n"

Write-Note '08-AI-Context\about-me.md' @"
---
type: ai-context
updated: $today
---
# About me

- Name: Yigit
- Role / focus:
- Preferred language(s): Turkish, English
- Tech stack / tools:
- Communication style (short, direct, step-by-step...):

## Current priorities
1.
2.
3.

## Rules for AI assistants
- Ask before destructive or outward-facing actions.
- Report results honestly, including failures.
"@

Write-Note '08-AI-Context\projects-index.md' @"
---
type: ai-context
updated: $today
---
# Projects index

| Project | Status | Repo / location | One-line summary |
|---|---|---|---|
| contextport | active | github.com/yyigit00707-source/contextport | Portable AI context export CLI |
"@

# ---- Templates ----
Write-Note '_templates\daily.md' @"
---
type: daily
date: {{date}}
---
# {{date}}

## Top 3
- [ ]
- [ ]
- [ ]

## Notes

## Done

## Tomorrow
"@

Write-Note '_templates\weekly-review.md' @"
---
type: weekly
week: {{date}}
---
# Weekly review {{date}}

- [ ] Inbox emptied
- [ ] Projects reviewed (next action for each)
- [ ] Calendar checked (next 2 weeks)
- [ ] Notes linked / cleaned

## Wins

## Lessons

## Next week focus
"@

Write-Note '_templates\project.md' @"
---
type: project
status: active
started: {{date}}
goal:
---
# {{title}}

## Goal / done means

## Next actions
- [ ]

## Notes / links

## Log
- {{date}}: created
"@

Write-Note '_templates\permanent-note.md' @"
---
type: permanent
created: {{date}}
tags: []
---
# {{title}}

(One idea, in your own words.)

## Links
- [[ ]]
"@

Write-Note '_templates\literature-note.md' @"
---
type: literature
source:
author:
created: {{date}}
---
# {{title}}

## Summary

## Key quotes

## My thoughts
"@

Write-Note '_templates\person.md' @"
---
type: person
created: {{date}}
---
# {{title}}

- Contact:
- Context (how we know each other):

## Notes
"@

# ---- Today's daily note + first inbox note ----
Write-Note "05-Journal\daily\$today.md" @"
---
type: daily
date: $today
---
# $today

## Top 3
- [ ] Run make-second-brain.ps1 (done)
- [ ] Fill 08-AI-Context\about-me.md
- [ ] Capture first notes in 00-Inbox

## Notes
"@

Write-Note '00-Inbox\welcome.md' "# Welcome`n`nSecond brain created $today. Read README.md in the vault root.`n"

# ---- Obsidian-friendly ignore + optional git ----
Write-Note '.gitignore' ".obsidian/workspace*.json`n.obsidian/cache`n.trash/`nThumbs.db`n.DS_Store`n"

if ($GitInit) {
  if (Get-Command git -ErrorAction SilentlyContinue) {
    if (-not (Test-Path -LiteralPath (Join-Path $Root '.git'))) {
      Push-Location $Root
      try {
        git init | Out-Null
        git add -A | Out-Null
        git commit -m "Initial second brain structure" | Out-Null
        Write-Host '  git    initialized with first commit' -ForegroundColor Green
      } finally { Pop-Location }
    } else {
      Write-Host '  git    repo already exists' -ForegroundColor DarkGray
    }
  } else {
    Write-Warning 'git not found; skipping -GitInit.'
  }
}

Write-Host ''
Write-Host 'Done. Open the folder in Obsidian or VS Code:' -ForegroundColor Cyan
Write-Host "  $Root"
