const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const ProjectVersion = sequelize.define('ProjectVersion', {
        cliente_id: {
            type: DataTypes.INTEGER,
            allowNull: false,
            primaryKey: true
        },
        cod_modulo: {
            type: DataTypes.STRING,
            allowNull: false,
            primaryKey: true
        },
        name: {
            type: DataTypes.STRING,
            allowNull: false,
            field: 'versao'
        },
        versao: {
            type: DataTypes.STRING,
            allowNull: false
        }
    }, {
        tableName: 'kmm.v$cliente_modulo_versao',
        timestamps: false // Oracle table doesn't have createdAt/updatedAt
    });
    return ProjectVersion;
};

