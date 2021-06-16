const {
    CognitoIdentityProviderClient
} = require("@aws-sdk/client-cognito-identity-provider");

const cognitoIdentityClient = new CognitoIdentityProviderClient({
    region: process.env.AWS_COGNITO_REGION,
    apiVersion: "2016-04-18",
});

module.exports = {cognitoIdentityClient}