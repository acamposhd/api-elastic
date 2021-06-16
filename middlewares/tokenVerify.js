const jwt = require("jsonwebtoken");
const jwkToPem = require("jwk-to-pem");
const { errorResponse } = require("../helpers/apiResponser");

/**
 * If we want to try this again we need to instal aws sdk
 */
// const AWS = require("aws-sdk");
// const cognitoidentityserviceprovider = new AWS.CognitoIdentityServiceProvider({
//     region: "us-east-1",
// });

const tokenVerify = (req, res, next) => {
    try {
        const token = req.header("Authorization");
        const jwk = JSON.parse(process.env.JWK);
        const pem = jwkToPem(jwk.keys[1]);
        if (!token)
            return errorResponse({
                res,
                code: 401,
                message: {
                    en: "Resource protected",
                    es: "Recurso protegido",
                },
                error: "No token was received",
            });

        jwt.verify(
            token,
            pem,
            { algorithms: ["RS256"] },
            (err, decodedToken) => {
                if (err) {
                    console.log(err);
                    return errorResponse({
                        res,
                        code: 401,
                        message: {
                            en: "Token provided is not valid",
                            es: "El token no es válido",
                        },
                        error: "Token is not valid",
                    });
                } else {
                    req.currentUser = {
                        sub: decodedToken.sub,
                        username: decodedToken.username,
                    };
                    next();
                }
            }
        );

        /**
         * If we want to try this again we need to instal aws sdk
         */
        // let params = {
        //     AccessToken: token /* required */,
        // };
        // cognitoidentityserviceprovider.getUser(params, (err, token) => {
        //     if (err) {
        //         errorResponse({
        //             res,
        //             code: 401,
        //             message: {
        //                 en: "Token provided is not valid",
        //                 es: "El token no es válido",
        //             },
        //             error: "Token is not valid",
        //         });
        //         console.log(err, err.stack);
        //     } else {
        //         const { UserAttributes } = token;
        //         const sub = UserAttributes[0].Value;
        //         console.log(sub); // successful response
        //         next();
        //     }
        //     // an error occurred
        // });
    } catch (error) {
        console.log(error);
        return errorResponse({
            res,
            code: 401,
            message: {
                en: "Token not valid, login again",
                es: "Token no válido, inicie sesión nuevamente",
            },
            error,
        });
    }
};

module.exports = tokenVerify;
