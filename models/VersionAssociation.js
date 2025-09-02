const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const VersionAssociation = sequelize.define('VersionAssociation', {
        endpointPath: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        endpointMethod: {
            type: DataTypes.STRING,
            allowNull: false,
        }
    });
    return VersionAssociation;
};

