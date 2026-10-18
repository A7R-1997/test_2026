pipeline {
    agent any

    stages {
        stage('1. Code Security Audit') {
            steps {
                echo 'Running NPM Security Audit inside Node container...'
                sh 'docker run --rm -v ${WORKSPACE}:/app -w /app node:18-alpine npm audit --audit-level=high || true'
            }
        }

        stage('2. Ephemeral DB & Integration Testing') {
            steps {
                script {
                    echo 'Starting isolated PostgreSQL container for testing...'
                    sh 'docker network create test-net || true'
                    sh 'docker run -d --name test-postgres --network test-net -e POSTGRES_PASSWORD=secret -e POSTGRES_DB=test_db postgres:15-alpine'
                    
                    sleep 5

                    // وضع الأوامر داخل علامات تنصيص مزدوجة لتنفذ بداخل مسار /app بشكل صحيح
                    sh 'docker run --rm --network test-net -e DATABASE_URL=postgresql://postgres:secret@test-postgres:5432/test_db -v ${WORKSPACE}:/app -w /app node:18-alpine sh -c "npm install && npm test || true"'

                    sh 'docker stop test-postgres && docker rm test-postgres || true'
                    sh 'docker network rm test-net || true'
                }
            }
        }

        stage('3. Build Production Docker Image') {
            steps {
                echo 'Building production Docker image...'
                sh 'docker build -t node-app:${BUILD_NUMBER} .'
            }
        }
    }

    post {
        always {
            sh 'docker rm -f test-postgres || true'
            sh 'docker network rm test-net || true'
        }
    }
}