const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const ProjectVersion = sequelize.define('ProjectVersion', {
        name: {
            type: DataTypes.STRING,
            allowNull: false,
        }
    });
    return ProjectVersion;
};

