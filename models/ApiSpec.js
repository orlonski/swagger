const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const ApiSpec = sequelize.define('ApiSpec', {
        name: {
            type: DataTypes.STRING,
            allowNull: false
        },
        yaml: {
            type: DataTypes.TEXT,
            allowNull: false
        }
    });
    return ApiSpec;
};

