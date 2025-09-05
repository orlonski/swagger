const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const Project = sequelize.define('Project', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            field: 'modulo_id'
        },
        cod_modulo: {
            type: DataTypes.STRING,
            allowNull: false,
            unique: true
        },
        name: {
            type: DataTypes.STRING,
            allowNull: false,
            field: 'nome'
        },
        descricao: {
            type: DataTypes.STRING,
            allowNull: true
        },
        versao: {
            type: DataTypes.STRING,
            allowNull: true
        }
    }, {
        tableName: 'kmm.v$modulo',
        timestamps: false,
        freezeTableName: true,
        quoteIdentifiers: false // Oracle não usa aspas duplas
    });
    return Project;
};

