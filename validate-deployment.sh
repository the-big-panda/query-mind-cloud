#!/bin/bash

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}=== NL2SQL Integration Deployment Validation ===${NC}\n"

FAILED=0
PASSED=0

# Function to print results
print_result() {
    local test_name=$1
    local result=$2
    if [ $result -eq 0 ]; then
        echo -e "${GREEN}✓${NC} $test_name"
        ((PASSED++))
    else
        echo -e "${RED}✗${NC} $test_name"
        ((FAILED++))
    fi
}

# ===== CHECK 1: Environment Variables =====
echo -e "${YELLOW}Checking Environment Variables...${NC}"

# Check JWT_SECRET
if grep -q "JWT_SECRET=" cloud-backend/.env 2>/dev/null; then
    JWT_SECRET_CB=$(grep "JWT_SECRET=" cloud-backend/.env | cut -d'=' -f2 | tr -d '"')
else
    JWT_SECRET_CB=""
fi

if grep -q "JWT_SECRET=" ../BE-Project/.env 2>/dev/null; then
    JWT_SECRET_BP=$(grep "JWT_SECRET=" ../BE-Project/.env | cut -d'=' -f2 | tr -d '"')
else
    JWT_SECRET_BP=$(grep "ACCESS_TOKEN=" ../BE-Project/.env | cut -d'=' -f2 | tr -d '"')
fi

if [ "$JWT_SECRET_CB" = "$JWT_SECRET_BP" ] && [ ! -z "$JWT_SECRET_CB" ]; then
    print_result "JWT_SECRET matches between services" 0
else
    print_result "JWT_SECRET matches between services" 1
fi

# Check PORT configurations
if grep -q "PORT=3000" cloud-backend/.env 2>/dev/null; then
    print_result "Cloud Backend PORT set to 3000" 0
else
    print_result "Cloud Backend PORT set to 3000" 1
fi

if grep -q "PORT=8080" ../BE-Project/.env 2>/dev/null || ! grep -q "^PORT=" ../BE-Project/.env; then
    print_result "BE-Project PORT configured" 0
else
    print_result "BE-Project PORT configured" 1
fi

# ===== CHECK 2: Docker Configuration =====
echo -e "\n${YELLOW}Checking Docker Configuration...${NC}"

if [ -f "docker-compose.yml" ]; then
    print_result "docker-compose.yml exists" 0
    
    if grep -q "be-project:" docker-compose.yml; then
        print_result "BE-Project service in docker-compose.yml" 0
    else
        print_result "BE-Project service in docker-compose.yml" 1
    fi
else
    print_result "docker-compose.yml exists" 1
fi

if [ -f "docker-compose.prod.yml" ]; then
    print_result "docker-compose.prod.yml exists" 0
else
    print_result "docker-compose.prod.yml exists" 1
fi

# ===== CHECK 3: Dockerfile Presence =====
echo -e "\n${YELLOW}Checking Dockerfiles...${NC}"

if [ -f "Dockerfile" ]; then
    print_result "Cloud Backend Dockerfile exists" 0
else
    print_result "Cloud Backend Dockerfile exists" 1
fi

if [ -f "../BE-Project/Dockerfile" ]; then
    print_result "BE-Project Dockerfile exists" 0
else
    print_result "BE-Project Dockerfile exists" 1
fi

# ===== CHECK 4: Package Dependencies =====
echo -e "\n${YELLOW}Checking Package Dependencies...${NC}"

if grep -q '"express"' package.json; then
    print_result "Cloud Backend has Express" 0
else
    print_result "Cloud Backend has Express" 1
fi

if grep -q '"pg"' package.json; then
    print_result "Cloud Backend has PostgreSQL driver" 0
else
    print_result "Cloud Backend has PostgreSQL driver" 1
fi

if grep -q '"redis"' package.json; then
    print_result "Cloud Backend has Redis client" 0
else
    print_result "Cloud Backend has Redis client" 1
fi

if grep -q '"jsonwebtoken"' package.json; then
    print_result "Cloud Backend has JWT" 0
else
    print_result "Cloud Backend has JWT" 1
fi

if grep -q '"express"' ../BE-Project/package.json; then
    print_result "BE-Project has Express" 0
else
    print_result "BE-Project has Express" 1
fi

if grep -q '"jsonwebtoken"' ../BE-Project/package.json; then
    print_result "BE-Project has JWT" 0
else
    print_result "BE-Project has JWT" 1
fi

# ===== CHECK 5: Configuration Files =====
echo -e "\n${YELLOW}Checking Configuration Files...${NC}"

if [ -f ".env.example" ]; then
    print_result ".env.example exists for Cloud Backend" 0
else
    print_result ".env.example exists for Cloud Backend" 1
fi

if [ -f "../BE-Project/.env.example" ]; then
    print_result ".env.example exists for BE-Project" 0
else
    print_result ".env.example exists for BE-Project" 1
fi

if [ -f "src/config/env.js" ]; then
    print_result "Cloud Backend env.js configuration exists" 0
else
    print_result "Cloud Backend env.js configuration exists" 1
fi

# ===== CHECK 6: Documentation =====
echo -e "\n${YELLOW}Checking Documentation...${NC}"

if [ -f "INTEGRATION_GUIDE.md" ]; then
    print_result "Integration guide exists" 0
else
    print_result "Integration guide exists" 1
fi

if [ -f "../BE-Project/Dockerfile" ]; then
    print_result "BE-Project Dockerfile exists" 0
else
    print_result "BE-Project Dockerfile exists" 1
fi

# ===== CHECK 7: Auth Compatibility =====
echo -e "\n${YELLOW}Checking Authentication Setup...${NC}"

if grep -q "normalizeUserFields" src/middleware/auth.js; then
    print_result "Cloud Backend has user field normalization" 0
else
    print_result "Cloud Backend has user field normalization" 1
fi

if grep -q "normalizeUserFields" ../BE-Project/util/userAuth.js; then
    print_result "BE-Project has user field normalization" 0
else
    print_result "BE-Project has user field normalization" 1
fi

# ===== CHECK 8: Database Configuration =====
echo -e "\n${YELLOW}Checking Database Configuration...${NC}"

if grep -q "postgresql\|postgres" docker-compose.yml; then
    print_result "Docker Compose includes PostgreSQL" 0
else
    print_result "Docker Compose includes PostgreSQL" 1
fi

if grep -q "redis" docker-compose.yml; then
    print_result "Docker Compose includes Redis" 0
else
    print_result "Docker Compose includes Redis" 1
fi

# ===== SUMMARY =====
echo -e "\n${BLUE}=== Validation Summary ===${NC}"
echo -e "${GREEN}Passed: $PASSED${NC}"
echo -e "${RED}Failed: $FAILED${NC}"

if [ $FAILED -eq 0 ]; then
    echo -e "\n${GREEN}✓ All checks passed! Ready for deployment.${NC}"
    exit 0
else
    echo -e "\n${RED}✗ Some checks failed. Please review the issues above.${NC}"
    exit 1
fi
