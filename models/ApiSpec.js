const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const ApiSpec = sequelize.define('ApiSpec', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        name: {
            type: DataTypes.STRING(255),
            allowNull: false
        },
        yaml: {
            type: DataTypes.TEXT('long'), // CLOB no Oracle
            allowNull: false
        }
    }, {
        tableName: 'kmm.api_specs',
        timestamps: false,
        // Desabilitar cache no modelo
        cache: false,
        paranoid: false,
        hooks: false
    });
    return ApiSpec;
};

