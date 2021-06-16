const successResponse = ({
  res,
  headers = { "Content-Type": "application/json" },
  message = { es: "Éxito", en: "Success" },
  body,
}) => {
  let response = {
    statusCode: 200,
    headers,
    message,
    body,
  };
  return res.status(200).json(response);
};
const errorResponse = ({
  res,
  headers = { "Content-Type": "application/json" },
  message = { es: "Error", en: "Error" },
  code = 500,
  error,
}) => {
  let response = {
    statusCode: code,
    headers,
    message,
    body: JSON.stringify(error),
  };
  return res.status(code).json(response);
};
const responser = {
  successResponse,
  errorResponse,
};
module.exports = responser;
