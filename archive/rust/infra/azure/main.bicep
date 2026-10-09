@description('Azure region for the Container Apps environment.')
param location string = resourceGroup().location

@description('Globally unique Azure Container Registry name.')
param registryName string

@description('Container App name.')
param containerAppName string

@description('Managed environment name.')
param environmentName string

@description('Log Analytics workspace name.')
param logAnalyticsName string

@description('Initial image. The release workflow replaces this with a commit-tagged image.')
param image string = 'mcr.microsoft.com/azuredocs/containerapps-helloworld:latest'

@secure()
param backendSecret string

@secure()
param captchaKey string

param allowedOrigins string
param roomSize int = 13
param daySeconds int = 60
param nightSeconds int = 45

resource registry 'Microsoft.ContainerRegistry/registries@2023-07-01' = {
  name: registryName
  location: location
  sku: { name: 'Basic' }
  properties: {
    adminUserEnabled: false
  }
}

resource logs 'Microsoft.OperationalInsights/workspaces@2022-10-01' = {
  name: logAnalyticsName
  location: location
  properties: {
    retentionInDays: 30
    features: { enableLogAccessUsingOnlyResourcePermissions: true }
    sku: { name: 'PerGB2018' }
  }
}

resource environment 'Microsoft.App/managedEnvironments@2024-03-01' = {
  name: environmentName
  location: location
  properties: {
    appLogsConfiguration: {
      destination: 'log-analytics'
      logAnalyticsConfiguration: {
        customerId: logs.properties.customerId
        sharedKey: logs.listKeys().primarySharedKey
      }
    }
  }
}

resource app 'Microsoft.App/containerApps@2024-03-01' = {
  name: containerAppName
  location: location
  identity: { type: 'SystemAssigned' }
  properties: {
    managedEnvironmentId: environment.id
    configuration: {
      activeRevisionsMode: 'Single'
      ingress: {
        external: true
        targetPort: 8000
        transport: 'auto'
        allowInsecure: false
      }
      registries: [
        {
          server: registry.properties.loginServer
          identity: 'system'
        }
      ]
      secrets: [
        { name: 'backend-secret', value: backendSecret }
        { name: 'captcha-key', value: captchaKey }
      ]
    }
    template: {
      containers: [
        {
          name: 'game-server'
          image: image
          resources: {
            cpu: 0.25
            memory: '0.5Gi'
          }
          env: [
            { name: 'PORT', value: '8000' }
            { name: 'RUST_LOG', value: 'game_server=info,tower_http=info' }
            { name: 'ROOM_SIZE', value: string(roomSize) }
            { name: 'DAY_SECONDS', value: string(daySeconds) }
            { name: 'NIGHT_SECONDS', value: string(nightSeconds) }
            { name: 'ALLOWED_ORIGINS', value: allowedOrigins }
            { name: 'BACKEND_SECRET', secretRef: 'backend-secret' }
            { name: 'CAPTCHA_KEY', secretRef: 'captcha-key' }
          ]
        }
      ]
      scale: {
        minReplicas: 0
        maxReplicas: 1
        rules: [
          {
            name: 'http-traffic'
            http: { metadata: { concurrentRequests: '20' } }
          }
        ]
      }
    }
  }
}

resource registryPull 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(registry.id, app.id, 'AcrPull')
  scope: registry
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '7f951dda-4ed3-4680-a7ca-43fe172d538d')
    principalId: app.identity.principalId
    principalType: 'ServicePrincipal'
  }
}

output registryLoginServer string = registry.properties.loginServer
output containerAppFqdn string = app.properties.configuration.ingress.fqdn
