pipeline {
    agent any

    environment {
        CI = 'true'
        NG_CLI_ANALYTICS = 'false'

        // Project source. Jenkins copies it into its own workspace and builds there, so a
        // running `ng serve` can't lock node_modules and the build never touches this folder.
        SRC_DIR    = 'C:\\Users\\uzair.sohail\\Desktop\\Pipeline sample project'
        DIST_DIR   = 'dist\\calculator-app\\browser'
        DEPLOY_DIR = 'C:\\inetpub\\wwwroot\\CalculatorApp'
        IIS_SITE   = 'CalculatorApp'
        IIS_PORT   = '8090'
        APPCMD     = 'C:\\Windows\\System32\\inetsrv\\appcmd.exe'
        SONAR_HOST_URL = 'http://localhost:9000'
    }

    options {
        timestamps()
        disableConcurrentBuilds()
        buildDiscarder(logRotator(numToKeepStr: '10'))
    }

    stages {
        stage('Get Source') {
            steps {
                // Mirror the project minus generated folders. robocopy exit codes 0-7 mean success.
                bat '''
                robocopy "%SRC_DIR%" "%WORKSPACE%" /MIR /NFL /NDL /NP /NJH ^
                    /XD node_modules dist .angular coverage coverage-report .vscode .scannerwork
                if %ERRORLEVEL% GEQ 8 exit /b %ERRORLEVEL%
                exit /b 0
                '''
            }
        }

        stage('Install Dependencies') {
            steps {
                bat 'node -v && npm -v'
                bat 'npm ci --no-audit --no-fund'
            }
        }

        stage('Unit Tests') {
            steps {
                // Fails the build if any test fails or coverage drops below 100% (see karma.conf.js).
                bat 'npm run test:ci'
            }
            post {
                always {
                    archiveArtifacts artifacts: 'coverage/**', allowEmptyArchive: true
                }
            }
        }

        stage('SonarQube Analysis') {
            environment {
                // Jenkins credential (kind: Secret text, ID: sonar-token) holding a SonarQube analysis token.
                SONAR_TOKEN = credentials('sonar-token')
            }
            steps {
                // Fail fast with a clear message if the SonarQube server isn't running.
                powershell '''
                try {
                    $status = (Invoke-RestMethod "$env:SONAR_HOST_URL/api/system/status" -TimeoutSec 10).status
                } catch {
                    throw "SonarQube is not reachable at $env:SONAR_HOST_URL. Start D:\\sonarqube\\bin\\windows-x86-64\\StartSonar.bat"
                }
                if ($status -ne 'UP') { throw "SonarQube status is '$status', expected 'UP'" }
                '''

                // Uses sonar-project.properties and the lcov report from the test stage.
                // qualitygate.wait fails this stage if the project fails its Quality Gate.
                // scm.disabled: the source is copied in, not checked out from git.
                bat 'npm run sonar -- -Dsonar.host.url=%SONAR_HOST_URL% -Dsonar.qualitygate.wait=true -Dsonar.qualitygate.timeout=300 -Dsonar.scm.disabled=true'
            }
            post {
                always {
                    echo "SonarQube report: ${env.SONAR_HOST_URL}/dashboard?id=Calculator-App"
                }
            }
        }

        stage('Build') {
            steps {
                bat 'npm run build -- --configuration production'
            }
        }

        stage('Archive') {
            steps {
                archiveArtifacts artifacts: 'dist/**', fingerprint: true
            }
        }

        stage('Deploy to IIS') {
            steps {
                bat '''
                sc query W3SVC >nul 2>&1
                if errorlevel 1 (
                    echo IIS web server is not installed. Run setup-iis.ps1 as Administrator first.
                    exit /b 1
                )

                if not exist "%DIST_DIR%\\index.html" (
                    echo Build output not found at %DIST_DIR%
                    exit /b 1
                )

                robocopy "%DIST_DIR%" "%DEPLOY_DIR%" /MIR /NFL /NDL /NP /NJH
                if %ERRORLEVEL% GEQ 8 exit /b %ERRORLEVEL%

                rem Create the IIS site the first time; Jenkins runs as SYSTEM, which has admin rights.
                "%APPCMD%" list site /name:"%IIS_SITE%" >nul 2>&1
                if errorlevel 1 (
                    "%APPCMD%" add site /name:"%IIS_SITE%" /bindings:http/*:%IIS_PORT%: /physicalPath:"%DEPLOY_DIR%" || exit /b 1
                )
                "%APPCMD%" start site /site.name:"%IIS_SITE%" >nul 2>&1

                exit /b 0
                '''
            }
        }

        stage('Smoke Test') {
            steps {
                powershell '''
                $url = "http://localhost:$env:IIS_PORT/"
                $res = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 30
                if ($res.StatusCode -ne 200 -or $res.Content -notmatch '<app-root') {
                    throw "Unexpected response from $url (status $($res.StatusCode))"
                }
                Write-Host "Deployed app is live at $url"
                '''
            }
        }
    }

    post {
        success {
            echo "Build and deploy successful: http://localhost:${env.IIS_PORT}/"
        }
        failure {
            echo 'Pipeline failed, check the console output.'
        }
    }
}
