# Azure OpenAI Setup

## Required Environment Variables

To fix the 404 errors with the Azure OpenAI API, you need to set up the following environment variables in both your `apps/web/.env` and `apps/api/.env` files:

### For Web App (apps/web/.env)

```
# Azure OpenAI Configuration
AZURE_OPENAI_API_KEY=your_azure_api_key
AZURE_OPENAI_ENDPOINT=https://unity-ma79uauc-eastus2.cognitiveservices.azure.com/
AZURE_OPENAI_DEPLOYMENT_NAME=gpt-4o
```

### For API Server (apps/api/.env)

```
# Azure OpenAI Configuration
AZURE_OPENAI_API_KEY=your_azure_api_key
AZURE_OPENAI_ENDPOINT=https://unity-ma79uauc-eastus2.cognitiveservices.azure.com/
AZURE_OPENAI_DEPLOYMENT_NAME=gpt-4o
```

## Notes

1. Make sure your deployment name (`gpt-4o`) exactly matches what you've configured in your Azure portal.
2. The endpoint should be your Azure OpenAI service endpoint without any additional paths.
3. The API key should be copied from your Azure OpenAI service.

## Authentication Methods

The code has been updated to use the newer Azure OpenAI SDK format:

```javascript
import { AzureOpenAI } from 'openai';

const openai = new AzureOpenAI({
  apiKey: process.env.AZURE_OPENAI_API_KEY,
  endpoint: process.env.AZURE_OPENAI_ENDPOINT,
  deployment: process.env.AZURE_OPENAI_DEPLOYMENT_NAME,
  apiVersion: "2024-04-01-preview"
});
```

## API Calling

When using the Azure OpenAI client, make sure to specify the model like this:

```javascript
const completion = await openai.chat.completions.create({
  model: process.env.AZURE_OPENAI_DEPLOYMENT_NAME || "gpt-4o",
  messages: [
    { role: "system", content: "You are a helpful assistant." },
    { role: "user", content: "Your prompt here" }
  ],
  temperature: 0.7,
  max_tokens: 500
});
```

## Troubleshooting

If you continue to see 404 errors:

1. Check that the deployment exists in your Azure OpenAI service
2. Verify that you have sufficient quota for the model you're using
3. Make sure the API version is correct (2024-04-01-preview is recommended)
4. Check your Azure subscription status 