const getCurrentDateWithoutTime = () => {
    const dateObj = new Date(Date.now());
    const formmatedDate = `${dateObj.getFullYear()}-${
        dateObj.getMonth() + 1
    }-${dateObj.getDate()}`;
    return new Date(formmatedDate);
};
const getCurrentDate = () => {
    return new Date().toISOString();
};
const dates = {
    getCurrentDate: getCurrentDate,
    getCurrentDateWithoutTime: getCurrentDateWithoutTime,
};
module.exports = dates;
