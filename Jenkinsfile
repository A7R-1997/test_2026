
pipeline {
    agent any

    options {
        timestamps()
        disableConcurrentBuilds()
        timeout(time: 15, unit: 'MINUTES')
    }

    environment {
        NODE_IMAGE = 'node:18-alpine'
        POSTGRES_IMAGE = 'postgres:15-alpine'

        DB_NAME = 'test_db'
        DB_USER = 'postgres'
        DB_PASSWORD = 'secret'
        DB_HOST = 'test-postgres'
        DB_PORT = '5432'

        TEST_NETWORK = "test-net-${BUILD_NUMBER}"
        TEST_CONTAINER = "test-postgres-${BUILD_NUMBER}"

        TEST_IMAGE = "node-test:${BUILD_NUMBER}"
        APP_IMAGE = "node-app:${BUILD_NUMBER}"
    }

    stages {

        stage('1. Checkout & Inspect') {
            steps {
                echo 'Checking project files...'

                sh '''
                    set -eu

                    echo "Workspace: $WORKSPACE"
                    pwd
                    ls -la

                    test -f package.json || {
                        echo "ERROR: package.json not found"
                        exit 1
                    }

                    test -f Dockerfile || {
                        echo "ERROR: Dockerfile not found"
                        exit 1
                    }

                    echo "Project files verified."
                '''
            }
        }

        stage('2. Code Security Audit') {
            steps {
                echo 'Running npm audit...'

                sh '''
                    set -eu

                    docker run --rm \
                        -v "$WORKSPACE:/app" \
                        -w /app \
                        "$NODE_IMAGE" \
                        npm audit --audit-level=high
                '''
            }
        }

        stage('3. Build Test Image') {
            steps {
                echo 'Building isolated test image...'

                sh '''
                    set -eu

                    docker build \
                        -f - \
                        -t "$TEST_IMAGE" \
                        . <<'DOCKERFILE'
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

DOCKERFILE

                    docker run --rm \
                        "$TEST_IMAGE" \
                        node -e "console.log('Node.js test image is ready')"
                '''
            }
        }

        stage('4. Start PostgreSQL') {
            steps {
                sh '''
                    set -eu

                    docker network create "$TEST_NETWORK"

                    docker run -d \
                        --name "$TEST_CONTAINER" \
                        --network "$TEST_NETWORK" \
                        -e POSTGRES_USER="$DB_USER" \
                        -e POSTGRES_PASSWORD="$DB_PASSWORD" \
                        -e POSTGRES_DB="$DB_NAME" \
                        --health-cmd="pg_isready -U postgres -d test_db" \
                        --health-interval=2s \
                        --health-timeout=3s \
                        --health-retries=30 \
                        "$POSTGRES_IMAGE"
                '''

                script {
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
                                error('PostgreSQL is unhealthy')
                            }

                            return status == 'healthy'
                        }
                    }
                }

                echo 'PostgreSQL is ready.'
            }
        }

        stage('5. Database Integration Tests') {
            steps {
                script {
                    def hasTestScript = sh(
                        script: '''
                            docker run --rm \
                                "$TEST_IMAGE" \
                                node -e "
                                    const p = require('./package.json');
                                    process.exit(
                                        p.scripts && p.scripts.test ? 0 : 1
                                    );
                                "
                        ''',
                        returnStatus: true
                    ) == 0

                    if (!hasTestScript) {
                        error(
                            'No test script found in package.json. ' +
                            'Configure a real test command before continuing.'
                        )
                    }

                    withEnv([
                        "DATABASE_URL=postgresql://${DB_USER}:${DB_PASSWORD}@${DB_HOST}:${DB_PORT}/${DB_NAME}"
                    ]) {
                        sh '''
                            set -eu

                            docker run --rm \
                                --network "$TEST_NETWORK" \
                                -e DATABASE_URL="$DATABASE_URL" \
                                "$TEST_IMAGE" \
                                npm test
                        '''
                    }
                }
            }
        }

        stage('6. Build Production Docker Image') {
            steps {
                echo 'Building production image using Dockerfile...'

                sh '''
                    set -eu

                    docker build \
                        -t "$APP_IMAGE" \
                        .

                    docker image inspect "$APP_IMAGE" >/dev/null

                    echo "Production image built: $APP_IMAGE"
                '''
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
            echo 'Pipeline failed. Check the stage logs.'
        }
    }
}
