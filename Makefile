#!/usr/bin/make

include .env

export BASE_DIR := $(realpath $(dir $(abspath $(lastword $(MAKEFILE_LIST)))))
export DOLLAR := $$
export DOCKER_CONTENT_TRUST=1 # This enables trust mode so that Docker doesn't just pull images from untrusted servers.
export COMPOSE_DOCKER_CLI_BUILD=1 # This improves rebuild time. @LINK: https://docs.docker.com/develop/develop-images/build_enhancements/
DOCKER_DIR := $(BASE_DIR)/docker
DOCKER_COMPOSE_CONFIG := --user=$(CURRENT_USER_ID):$(CURRENT_GROUP_ID)

DOCKER := docker
CONTAINER_TYPE := services
DOCKER_COMPOSE := $(DOCKER) compose -f "$(DOCKER_DIR)/docker-compose.$(CONTAINER_TYPE).yml" --env-file "$(BASE_DIR)/.env" $(foreach prof, $(DOCKER_COMPOSE_PROFILES),--profile $(prof))
ENVSUBST := envsubst

.PHONY: help
.DEFAULT_GOAL := help

---------------: ## ------[ Container management ]---------
up: ## Start the project.
	$(DOCKER_COMPOSE) up -d $(c)
	
down: ## Stop the project.
	$(DOCKER_COMPOSE) down --remove-orphans

restart: ## Fully restart all containers.
	$(DOCKER_COMPOSE) down --remove-orphans
	$(DOCKER_COMPOSE) up -d $(c)

build: ## Build a Docker image.
	$(DOCKER_COMPOSE) build $(c)

run: ## Run a command in a new container.
	$(DOCKER_COMPOSE) run --rm $(DOCKER_COMPOSE_CONFIG) $(c)

exec: ## Run a command in existing container.
	$(DOCKER_COMPOSE) exec $(DOCKER_COMPOSE_CONFIG) $(c)

list: ## List all running containers.
	$(DOCKER_COMPOSE) ls
	
log: ## Get a container's logs.
	$(DOCKER_COMPOSE) logs $(c)
	
---------------: ## ------[ Project management ]---------

install: ## Run installation script.
	echo "Installing NPM packages..."
	$(DOCKER_COMPOSE) run --rm $(DOCKER_COMPOSE_CONFIG) tickers-processing-server npm ci
	echo "Building the tickers processing server..."
	$(DOCKER_COMPOSE) run --rm $(DOCKER_COMPOSE_CONFIG) tickers-processing-server npm run build:server
	$(DOCKER_COMPOSE) down --remove-orphans
	
---------------: ## ------[ Utility commands ]---------
help: ## Print short description of each available command.
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z0-9_-]+:.*?## / {printf "  \033[36m%-18s\033[0m %s\n", $$1, $$2}' $(MAKEFILE_LIST)
