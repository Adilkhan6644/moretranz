@echo off
echo 🔄 Updating Moretranz API...
docker-compose down
docker-compose up -d --build
echo ✅ Update completed!
docker-compose ps
pause
