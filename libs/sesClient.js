const  { SESClient } = require("@aws-sdk/client-ses");
// Set the AWS Region.
const REGION = "us-east-1"; //e.g. "us-east-1"
// Create SES service object.
const sesClient = new SESClient({
    region: REGION,
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
});
module.exports  = { sesClient };