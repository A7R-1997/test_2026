pipeline {
    agent any

    stages {
        stage('0. Sync Workspace Files') {
            steps {
                echo 'Copying project files to Jenkins workspace...'
                // نسخ الملفات مباشرة من المجلد المربوط إلى مجلد الـ Workspace الحالي
                sh 'cp -r /app/. . || true'
            }
        }

        stage('1. Code Security Audit') {
            steps {
                echo 'Running NPM Security Audit...'
                sh 'npm audit --audit-level=high || true'
            }
        }

        stage('2. Ephemeral DB & Integration Testing') {
            steps {
                script {
                    echo 'Starting isolated PostgreSQL container for testing...'
                    sh 'docker network create test-net || true'
                    sh 'docker run -d --name test-postgres --network test-net -e POSTGRES_PASSWORD=secret -e POSTGRES_DB=test_db postgres:15-alpine'
                    
                    sleep 5

                    // تشغيل الـ npm install والـ tests بعد أن أصبحت الملفات موجودة في الـ Workspace
                    sh 'npm install'
                    sh 'npm test || true'

                    sh 'docker stop test-postgres && docker rm test-postgres || true'
                    sh 'docker network rm test-net || true'
                }
            }
        }

        stage('3. Build Production Docker Image') {
            steps {
                echo 'Building production image...'
                // بناء الصورة من مسار الـ Workspace الحالي بعد اكتمال النسخ ووجود الـ Dockerfile
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