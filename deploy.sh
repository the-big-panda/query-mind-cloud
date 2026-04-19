#!/bin/bash

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}=== NL2SQL Stack Deployment Script ===${NC}\n"

# Parse arguments
MODE=${1:-dev}

if [ "$MODE" == "--help" ] || [ "$MODE" == "-h" ]; then
    echo "Usage: ./deploy.sh [mode]"
    echo ""
    echo "Modes:"
    echo "  dev           - Run with docker-compose (default)"
    echo "  prod          - Run with docker-compose.prod.yml"
    echo "  down          - Stop all services"
    echo "  logs          - Show service logs"
    echo "  validate      - Validate deployment configuration"
    echo "  help          - Show this help message"
    exit 0
fi

case $MODE in
    dev)
        echo -e "${YELLOW}Starting services in development mode...${NC}\n"
        docker-compose up -d
        echo -e "\n${GREEN}Services started!${NC}"
        echo -e "Cloud Backend API: ${BLUE}http://localhost:3000/api${NC}"
        echo -e "BE-Project API: ${BLUE}http://localhost:8080${NC}"
        echo -e "PostgreSQL: ${BLUE}localhost:5432${NC}"
        echo -e "Redis: ${BLUE}localhost:6379${NC}"
        echo -e "\nView logs with: ${YELLOW}docker-compose logs -f${NC}"
        ;;
    
    prod)
        echo -e "${YELLOW}Starting services in production mode...${NC}\n"
        
        # Check if .env file exists
        if [ ! -f ".env" ]; then
            echo -e "${RED}Error: .env file not found${NC}"
            echo -e "Please copy .env.prod.example to .env and update values"
            exit 1
        fi
        
        docker-compose -f docker-compose.prod.yml up -d
        echo -e "\n${GREEN}Production services started!${NC}"
        echo -e "Cloud Backend API: ${BLUE}http://localhost:3000/api${NC}"
        echo -e "View logs with: ${YELLOW}docker-compose -f docker-compose.prod.yml logs -f${NC}"
        ;;
    
    down)
        echo -e "${YELLOW}Stopping all services...${NC}"
        docker-compose down
        echo -e "${GREEN}Services stopped${NC}"
        ;;
    
    logs)
        echo -e "${YELLOW}Showing service logs...${NC}"
        docker-compose logs -f
        ;;
    
    validate)
        echo -e "${YELLOW}Validating deployment configuration...${NC}\n"
        bash validate-deployment.sh
        ;;
    
    *)
        echo -e "${RED}Unknown mode: $MODE${NC}"
        echo -e "Use ${YELLOW}./deploy.sh --help${NC} for usage information"
        exit 1
        ;;
esac
