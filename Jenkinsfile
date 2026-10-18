
pipeline {
    agent any

    environment {
        NODE_IMAGE = 'node:18-alpine'
        POSTGRES_IMAGE = 'postgres:15-alpine'
        DB_NAME = 'test_db'
        DB_USER = 'postgres'
        DB_PASSWORD = 'secret'
        DB_HOST = 'test-postgres'
        DB_PORT = '5432'
        TEST_NETWORK = 'test-net'
        TEST_CONTAINER = 'test-postgres'
        APP_IMAGE = "node-app:${BUILD_NUMBER}"
    }

    stages {
        stage('1. Checkout & Inspect') {
            steps {
                echo 'Checking project files...'

                sh '''
                    set -eu

                    echo "Workspace: $WORKSPACE"
                    ls -la

                    if [ ! -f package.json ]; then
                        echo "ERROR: package.json not found in workspace root."
                        echo "Checking subdirectories..."
                        find . -maxdepth 4 -name package.json \
                            -not -path '*/node_modules/*' || true

                        echo "Update the working directory if the app is in a subfolder."
                        exit 1
                    fi

                    echo "package.json found."
                '''
            }
        }

        stage('2. Code Security Audit') {
            steps {
                echo 'Running npm security audit...'

                sh '''
                    set -eu

                    docker run --rm \
                        -v "$WORKSPACE:/app" \
                        -w /app \
                        node:18-alpine \
                        npm audit --audit-level=high
                '''
            }
        }

        stage('3. Start PostgreSQL & Integration Tests') {
            steps {
                script {
                    try {
                        sh '''
                            set -eu

                            docker network create "$TEST_NETWORK"

                            docker run -d \
                                --name "$TEST_CONTAINER" \
                                --network "$TEST_NETWORK" \
                                -e POSTGRES_USER="$DB_USER" \
                                -e POSTGRES_PASSWORD="$DB_PASSWORD" \
                                -e POSTGRES_DB="$DB_NAME" \
                                --health-cmd="pg_isready -U $DB_USER -d $DB_NAME" \
                                --health-interval=2s \
                                --health-timeout=3s \
                                --health-retries=30 \
                                "$POSTGRES_IMAGE"
                        '''

                        timeout(time: 2, unit: 'MINUTES') {
                            waitUntil {
                                def status = sh(
                                    script: '''
                                        docker inspect \
                                            --format='{{.State.Health.Status}}' \
                                            "$TEST_CONTAINER"
                                    ''',
                                    returnStdout: true
                                ).trim()

                                if (status == 'unhealthy') {
                                    error('PostgreSQL container is unhealthy.')
                                }

                                return status == 'healthy'
                            }
                        }

                        echo 'PostgreSQL is ready.'

                        withEnv([
                            "DATABASE_URL=postgresql://${DB_USER}:${DB_PASSWORD}@${DB_HOST}:${DB_PORT}/${DB_NAME}"
                        ]) {
                            sh '''
                                set -eu

                                docker run --rm \
                                    --network "$TEST_NETWORK" \
                                    -e DATABASE_URL="$DATABASE_URL" \
                                    -v "$WORKSPACE:/app" \
                                    -w /app \
                                    "$NODE_IMAGE" \
                                    npm install
                            '''

                            // Run tests only when a test script exists.
                            script {
                                def hasTestScript = sh(
                                    script: '''
                                        docker run --rm \
                                            -v "$WORKSPACE:/app" \
                                            -w /app \
                                            "$NODE_IMAGE" \
                                            node -e "
                                                const p = require('./package.json');
                                                process.exit(p.scripts && p.scripts.test ? 0 : 1);
                                            "
                                    ''',
                                    returnStatus: true
                                ) == 0

                                if (hasTestScript) {
                                    sh '''
                                        set -eu

                                        docker run --rm \
                                            --network "$TEST_NETWORK" \
                                            -e DATABASE_URL="$DATABASE_URL" \
                                            -v "$WORKSPACE:/app" \
                                            -w /app \
                                            "$NODE_IMAGE" \
                                            npm test
                                    '''
                                } else {
                                    error('No test script found in package.json. Configure tests before continuing.')
                                }
                            }
                        }
                    } finally {
                        sh '''
                            docker rm -f "$TEST_CONTAINER" 2>/dev/null || true
                            docker network rm "$TEST_NETWORK" 2>/dev/null || true
                        '''
                    }
                }
            }
        }

        stage('4. Build Production Docker Image') {
            steps {
                echo 'Building production Docker image...'

                sh '''
                    set -eu

                    docker build \
                        -t "$APP_IMAGE" \
                        .
                '''

                echo "Docker image built: ${APP_IMAGE}"
            }
        }
    }

    post {
        always {
            echo 'Cleaning up test resources...'

            sh '''
                docker rm -f "$TEST_CONTAINER" 2>/dev/null || true
                docker network rm "$TEST_NETWORK" 2>/dev/null || true
            '''
        }

        success {
            echo 'Pipeline completed successfully.'
        }

        failure {
            echo 'Pipeline failed. Review the logs above.'
        }
    }
}
