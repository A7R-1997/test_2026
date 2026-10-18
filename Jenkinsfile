
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
                sh '''
                    set -eu

                    echo "Workspace: $WORKSPACE"
                    ls -la

                    test -f package.json || {
                        echo "ERROR: package.json not found"
                        exit 1
                    }

                    test -f package-lock.json || {
                        echo "ERROR: package-lock.json not found"
                        exit 1
                    }

                    test -f Dockerfile || {
                        echo "ERROR: Dockerfile not found"
                        exit 1
                    }
                '''
            }
        }

        stage('2. Code Security Audit') {
            steps {
                echo 'Running npm audit...'

                sh '''
                    set -eu

                    docker build \
                        -f - \
                        -t "node-audit:${BUILD_NUMBER}" \
                        . <<'DOCKERFILE'
FROM node:18-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
DOCKERFILE

                    docker run --rm \
                        "node-audit:${BUILD_NUMBER}" \
                        npm audit --audit-level=high
                '''
            }
        }

        stage('3. Build Test Image') {
            steps {
                echo 'Building test image with development dependencies...'

                sh '''
                    set -eu

                    docker build \
                        -f - \
                        -t "$TEST_IMAGE" \
                        . <<'DOCKERFILE'
FROM node:18-alpine

WORKDIR /app

COPY package.json package-lock.json ./

RUN npm ci

COPY . .

DOCKERFILE

                    docker run --rm \
                        "$TEST_IMAGE" \
                        node -e "
                            require('supertest');
                            console.log('Supertest is installed.');
                        "
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
                                error('PostgreSQL container is unhealthy')
                            }

                            return status == 'healthy'
                        }
                    }
                }

                echo 'PostgreSQL is ready.'
            }
        }

        stage('5. Run Database Migrations') {
            steps {
                script {
                    def migrationFiles = sh(
                        script: '''
                            find migrations -maxdepth 1 -type f \
                                \\( -name '*.sql' -o -name '*.js' \\) \
                                2>/dev/null | sort
                        ''',
                        returnStdout: true
                    ).trim()

                    if (migrationFiles) {
                        echo 'Migration files detected.'

                        // SQL migrations are applied with psql.
                        def sqlMigrations = sh(
                            script: '''
                                find migrations -maxdepth 1 \
                                    -type f -name '*.sql' 2>/dev/null \
                                    | sort
                            ''',
                            returnStdout: true
                        ).trim()

                        if (sqlMigrations) {
                            sh '''
                                set -eu

                                docker run --rm \
                                    --network "$TEST_NETWORK" \
                                    -e PGPASSWORD="$DB_PASSWORD" \
                                    -v "$WORKSPACE/migrations:/migrations:ro" \
                                    "$POSTGRES_IMAGE" \
                                    sh -c '
                                        for f in $(find /migrations -maxdepth 1 -type f -name "*.sql" | sort); do
                                            echo "Applying $f"
                                            psql -v ON_ERROR_STOP=1 \
                                                -h "$DB_HOST" \
                                                -U "$DB_USER" \
                                                -d "$DB_NAME" \
                                                -f "$f"
                                        done
                                    '
                            '''
                        }
                    } else {
                        echo 'No SQL or JavaScript migration files detected; skipping migrations.'
                    }
                }
            }
        }

        stage('6. Integration Tests') {
            steps {
                script {
                    def hasTestScript = sh(
                        script: '''
                            docker run --rm "$TEST_IMAGE" node -e "
                                const p = require('./package.json');
                                process.exit(
                                    p.scripts && p.scripts.test ? 0 : 1
                                );
                            "
                        ''',
                        returnStatus: true
                    ) == 0

                    if (!hasTestScript) {
                        error('No test script found in package.json')
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

        stage('7. Build Production Image') {
            steps {
                echo 'Building production Docker image...'

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
            echo 'Pipeline failed. Check the logs for the first failing stage.'
        }
    }
}
