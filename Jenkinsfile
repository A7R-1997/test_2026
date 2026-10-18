pipeline {
    agent any

    options {
        timeout(time: 20, unit: 'MINUTES')
        buildDiscarder(logRotator(numToKeepStr: '10'))
    }

    stages {
        stage('0. Checkout') {
            steps {
                checkout scm
                sh 'ls -la "$WORKSPACE" && test -f package.json && test -f Dockerfile'
            }
        }

        stage('1. Code Security Audit') {
            steps {
                echo 'Running NPM Security Audit...'
                sh 'docker run --rm -v "$WORKSPACE":/app -w /app node:18-alpine npm audit --omit=dev --audit-level=high'
            }
        }

        stage('2. Ephemeral DB & Integration Testing') {
            steps {
                script {
                    echo 'Starting isolated PostgreSQL container for testing...'
                    sh 'docker network create test-net'
                    sh '''
                      docker run -d --name test-postgres --network test-net \
                        --health-cmd "pg_isready -U postgres" \
                        --health-interval 2s --health-retries 15 \
                        -e POSTGRES_PASSWORD=secret -e POSTGRES_DB=test_db \
                        postgres:15-alpine
                    '''
                    sh '''
                      for i in $(seq 1 30); do
                        docker exec test-postgres pg_isready -U postgres -d test_db && break
                        echo "Waiting for Postgres... ($i)"; sleep 2
                      done
                    '''
                    sh '''
                      docker run --rm --network test-net \
                        -e DATABASE_URL=postgresql://postgres:secret@test-postgres:5432/test_db \
                        -v "$WORKSPACE":/usr/src/app -w /usr/src/app \
                        -v npm-cache:/root/.npm \
                        node:18-alpine sh -c "npm ci && npm test"
                    '''
                }
            }
        }

        stage('3. Build Production Docker Image') {
            steps {
                echo 'Building production image...'
                sh 'docker build -t node-app:${BUILD_NUMBER} -t node-app:latest "$WORKSPACE"'
            }
        }
    }

    post {
        always {
            sh 'docker rm -f test-postgres || true'
            sh 'docker network rm test-net || true'
        }
        success {
            echo "Image built: node-app:${BUILD_NUMBER}"
        }
    }
}