<#
.SYNOPSIS
    Script de publication automatisée pour nodes n8n custom sur NPM

.DESCRIPTION
    Ce script automatise la procédure de publication d'un node n8n sur NPM.
    Il effectue toutes les vérifications nécessaires et guide l'utilisateur
    à travers le processus de publication.

.PARAMETER VersionType
    Type de mise à jour de version: patch, minor, ou major

.PARAMETER SkipTests
    Passe les tests de construction et lint (non recommandé)

.EXAMPLE
    .\publish-npm.ps1 -VersionType patch
    Publie une nouvelle version patch (correction de bugs)

.EXAMPLE
    .\publish-npm.ps1 -VersionType minor
    Publie une nouvelle version minor (nouvelles fonctionnalités)
#>

param(
    [Parameter(Mandatory=$false)]
    [ValidateSet("patch", "minor", "major")]
    [string]$VersionType = "patch",
    
    [Parameter(Mandatory=$false)]
    [switch]$SkipTests = $false,
    
    [Parameter(Mandatory=$false)]
    [switch]$DryRun = $false
)

# Configuration
$ErrorActionPreference = "Stop"
$WarningPreference = "Continue"

# Couleurs pour l''affichage
function Write-Success { Write-Host "✅ $args" -ForegroundColor Green }
function Write-Info { Write-Host "ℹ️  $args" -ForegroundColor Cyan }
function Write-Warning { Write-Host "⚠️  $args" -ForegroundColor Yellow }
function Write-Error { Write-Host "❌ $args" -ForegroundColor Red }
function Write-Step { Write-Host "`n🔄 $args" -ForegroundColor Blue }

# Banner
Write-Host @"
╔════════════════════════════════════════════════════════════╗
║       Publication NPM - n8n Custom Node                    ║
║       Script automatisé de publication                     ║
╚════════════════════════════════════════════════════════════╝
"@ -ForegroundColor Magenta

# Étape 1 : Vérifications préliminaires
Write-Step "Vérifications préliminaires"

# Vérifier la connexion NPM
Write-Info "Vérification de la connexion NPM..."
try {
    $npmUser = npm whoami 2>&1
    if ($npmUser -match "rderet") {
        Write-Success "Connecté en tant que: $npmUser"
    } else {
        Write-Error "Vous devez être connecté en tant que 'rderet'"
        Write-Info "Exécutez: npm login"
        exit 1
    }
} catch {
    Write-Error "Non connecté à NPM. Exécutez: npm login"
    exit 1
}

# Vérifier la branche Git
Write-Info "Vérification de la branche Git..."
$currentBranch = git branch --show-current
if ($currentBranch -ne "main") {
    Write-Warning "Vous n''êtes pas sur la branche main (branche actuelle: $currentBranch)"
    $continue = Read-Host "Voulez-vous continuer ? (y/N)"
    if ($continue -ne "y") {
        Write-Info "Publication annulée."
        exit 0
    }
}

# Vérifier l''état Git
Write-Info "Vérification de l''état Git..."
$gitStatus = git status --porcelain
if ($gitStatus) {
    Write-Warning "Des fichiers non committés existent:"
    git status --short
    $continue = Read-Host "Voulez-vous continuer ? (y/N)"
    if ($continue -ne "y") {
        Write-Info "Publication annulée. Committez vos changements d''abord."
        exit 0
    }
}

# Étape 2 : Lecture du package.json
Write-Step "Lecture de la configuration"
$packageJson = Get-Content "package.json" -Raw | ConvertFrom-Json
$currentVersion = $packageJson.version
$packageName = $packageJson.name
Write-Info "Package: $packageName"
Write-Info "Version actuelle: $currentVersion"

# Étape 3 : Build et tests
if (-not $SkipTests) {
    Write-Step "Construction et tests"
    
    Write-Info "Nettoyage du dossier dist..."
    if (Test-Path "dist") {
        Remove-Item -Recurse -Force "dist"
    }
    
    Write-Info "Construction du projet..."
    pnpm build
    if ($LASTEXITCODE -ne 0) {
        Write-Error "La construction a échoué"
        exit 1
    }
    Write-Success "Construction réussie"
    
    Write-Info "Exécution du linting..."
    pnpm lint
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Le linting a échoué"
        exit 1
    }
    Write-Success "Linting réussi"
} else {
    Write-Warning "Tests ignorés (--SkipTests)"
}

# Étape 4 : Mise à jour de la version
Write-Step "Mise à jour de la version"

# Calculer la nouvelle version
$versionParts = $currentVersion -split "\."
$major = [int]$versionParts[0]
$minor = [int]$versionParts[1]
$patch = [int]$versionParts[2]

switch ($VersionType) {
    "major" { $major++; $minor = 0; $patch = 0 }
    "minor" { $minor++; $patch = 0 }
    "patch" { $patch++ }
}

$newVersion = "$major.$minor.$patch"
Write-Info "Version actuelle: $currentVersion"
Write-Info "Nouvelle version: $newVersion ($VersionType)"

if ($DryRun) {
    Write-Warning "Mode DRY RUN - Aucun changement ne sera effectué"
} else {
    $confirm = Read-Host "Confirmer la mise à jour de version ? (y/N)"
    if ($confirm -ne "y") {
        Write-Info "Publication annulée."
        exit 0
    }
    
    npm version $VersionType --no-git-tag-version
    Write-Success "Version mise à jour: $newVersion"
}

# Étape 5 : Simulation de publication
Write-Step "Simulation de publication"
npm pack --dry-run
Write-Info "Vérifiez que les fichiers listés sont corrects"

if (-not $DryRun) {
    $confirm = Read-Host "Continuer avec la publication ? (y/N)"
    if ($confirm -ne "y") {
        Write-Info "Publication annulée."
        exit 0
    }
}

# Étape 6 : Publication
if ($DryRun) {
    Write-Info "DRY RUN - La publication serait effectuée ici"
} else {
    Write-Step "Publication sur NPM"
    npm publish --access public
    
    if ($LASTEXITCODE -ne 0) {
        Write-Error "La publication a échoué"
        exit 1
    }
    
    Write-Success "Publication réussie sur NPM !"
}

# Étape 7 : Tag Git et push
if (-not $DryRun) {
    Write-Step "Mise à jour Git"
    
    Write-Info "Création du commit de version..."
    git add package.json
    git commit -m "chore: bump version to $newVersion"
    
    Write-Info "Création du tag Git..."
    git tag -a "v$newVersion" -m "Version $newVersion"
    
    Write-Info "Push vers le repository distant..."
    git push --follow-tags
    
    Write-Success "Changements Git poussés"
}

# Étape 8 : Vérification
Write-Step "Vérification de la publication"

if (-not $DryRun) {
    Write-Info "Attente de la propagation NPM (30 secondes)..."
    Start-Sleep -Seconds 30
    
    Write-Info "Vérification du package sur NPM..."
    npm info $packageName
    
    if ($LASTEXITCODE -eq 0) {
        Write-Success "Package vérifié sur NPM"
    } else {
        Write-Warning "Le package n''est pas encore visible (délai de propagation)"
    }
}

# Résumé
Write-Host "`n╔════════════════════════════════════════════════════════════╗" -ForegroundColor Green
Write-Host "║           Publication terminée avec succès ! 🎉            ║" -ForegroundColor Green
Write-Host "╚════════════════════════════════════════════════════════════╝" -ForegroundColor Green

Write-Host "`n📦 Package: $packageName" -ForegroundColor Cyan
Write-Host "🔢 Version: $newVersion" -ForegroundColor Cyan
Write-Host "🔗 NPM: https://www.npmjs.com/package/$packageName" -ForegroundColor Cyan

Write-Host "`n✨ Prochaines étapes:" -ForegroundColor Yellow
Write-Host "  1. Vérifier la page NPM"
Write-Host "  2. Tester l''installation: npm install $packageName"
Write-Host "  3. Mettre à jour le CHANGELOG.md"
Write-Host "  4. Annoncer la release si pertinent"

Write-Host "`n✅ Publication complète !`n" -ForegroundColor Green
