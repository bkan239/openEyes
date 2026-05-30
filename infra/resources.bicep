param location string
param environmentName string
param tags object

var resourceToken string = uniqueString(subscription().id, environmentName, location)
var storageAccountName string = toLower('st${resourceToken}')
var appServicePlanName string = 'plan-${resourceToken}'
var apiAppName string = 'app-api-${resourceToken}'

resource storageAccount 'Microsoft.Storage/storageAccounts@2023-01-01' = {
  name: storageAccountName
  location: location
  tags: tags
  sku: {
    name: 'Standard_LRS'
  }
  kind: 'StorageV2'
  properties: {
    minimumTlsVersion: 'TLS1_2'
    allowBlobPublicAccess: false
    supportsHttpsTrafficOnly: true
  }
}

resource tableService 'Microsoft.Storage/storageAccounts/tableServices@2023-01-01' = {
  parent: storageAccount
  name: 'default'
}

resource openeyesTable 'Microsoft.Storage/storageAccounts/tableServices/tables@2023-01-01' = {
  parent: tableService
  name: 'openeyes'
}

var storageKey string = storageAccount.listKeys().keys[0].value
var storageConnectionString string = 'DefaultEndpointsProtocol=https;AccountName=${storageAccount.name};AccountKey=${storageKey};EndpointSuffix=${environment().suffixes.storage}'

resource appServicePlan 'Microsoft.Web/serverfarms@2022-09-01' = {
  name: appServicePlanName
  location: location
  tags: tags
  kind: 'linux'
  sku: {
    name: 'B1'
    tier: 'Basic'
  }
  properties: {
    reserved: true
  }
}

resource api 'Microsoft.Web/sites@2022-09-01' = {
  name: apiAppName
  location: location
  kind: 'app,linux'
  tags: union(tags, { 'azd-service-name': 'api' })
  properties: {
    serverFarmId: appServicePlan.id
    httpsOnly: true
    siteConfig: {
      linuxFxVersion: 'PYTHON|3.12'
      alwaysOn: true
      healthCheckPath: '/health'
      appCommandLine: 'python -m uvicorn app.main:app --host 0.0.0.0 --port 8000'
      appSettings: [
        {
          name: 'SCM_DO_BUILD_DURING_DEPLOYMENT'
          value: 'true'
        }
        {
          name: 'ENABLE_ORYX_BUILD'
          value: 'true'
        }
        {
          name: 'WEBSITES_PORT'
          value: '8000'
        }
        {
          name: 'STORAGE_BACKEND'
          value: 'azure'
        }
        {
          name: 'DATA_TABLE'
          value: 'openeyes'
        }
        {
          name: 'STAGE'
          value: environmentName
        }
        {
          name: 'AZURE_STORAGE_CONNECTION_STRING'
          value: storageConnectionString
        }
        {
          name: 'OPENAI_API_KEY'
          value: ''
        }
      ]
    }
  }
  identity: {
    type: 'SystemAssigned'
  }
}

output SERVICE_API_NAME string = api.name
output SERVICE_API_URI string = 'https://${api.properties.defaultHostName}'
output AZURE_STORAGE_CONNECTION_STRING string = storageConnectionString
