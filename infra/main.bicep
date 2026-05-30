targetScope = 'subscription'

@minLength(1)
@maxLength(64)
param environmentName string

@minLength(1)
param location string

var tags = {
  'azd-env-name': environmentName
}

resource rg 'Microsoft.Resources/resourceGroups@2022-09-01' = {
  name: 'rg-${environmentName}'
  location: location
  tags: tags
}

module resources 'resources.bicep' = {
  name: 'resources'
  scope: rg
  params: {
    location: location
    environmentName: environmentName
    tags: tags
  }
}

output SERVICE_API_NAME string = resources.outputs.SERVICE_API_NAME
output SERVICE_API_URI string = resources.outputs.SERVICE_API_URI
output AZURE_STORAGE_CONNECTION_STRING string = resources.outputs.AZURE_STORAGE_CONNECTION_STRING
output AZURE_LOCATION string = location
