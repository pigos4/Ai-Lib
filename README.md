# AI Multi Provider Library

TypeScript Node.js library to send one message and receive one response using multiple AI providers.

## Supported providers (v1)

- OpenAI (ChatGPT)
- Google Gemini
- Anthropic Claude
- Ollama Cloud
- Ollama Local

## Features

- AUTO mode with configurable provider order and fallback
- MANUAL mode to choose provider and model
- In MANUAL mode, if selected model is rate-limited, it retries with other models in the same provider
- In AUTO mode, if provider/model reaches rate limit, it moves to next available provider/model
- Normalized error handling across all providers

## Install

npm install

## Build

npm run build

## Test

npm test

## Quick use

import { createAIClient } from "ailib-router";

const client = createAIClient();
const result = await client.sendMessage({
  mode: "auto",
  message: "Explain clean architecture in 5 lines"
});

console.log(result.provider, result.model, result.content);

## Manual mode

const result = await client.sendMessage({
  mode: "manual",
  provider: "gemini",
  model: "gemini-2.0-flash",
  message: "Write a short poem"
});

## NestJS example

Use AIClient inside a service provider and call sendMessage in your service methods.

## Environment

Copy values from .env.example into your real .env file and set valid keys and model names.
