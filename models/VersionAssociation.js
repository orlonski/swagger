const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const VersionAssociation = sequelize.define('VersionAssociation', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        cliente_id: {
            type: DataTypes.INTEGER,
            allowNull: false
        },
        cod_modulo: {
            type: DataTypes.STRING(50),
            allowNull: false
        },
        versao: {
            type: DataTypes.STRING(50),
            allowNull: false
        },
        api_spec_id: {
            type: DataTypes.INTEGER,
            allowNull: false,
            field: 'api_spec_id'
        },
        endpointPath: {
            type: DataTypes.STRING(500),
            allowNull: false,
            field: 'endpoint_path'
        },
        endpointMethod: {
            type: DataTypes.STRING(10),
            allowNull: false,
            field: 'endpoint_method'
        }
    }, {
        tableName: 'kmm.version_associations',
        timestamps: false
    });
    return VersionAssociation;
};

