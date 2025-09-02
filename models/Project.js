const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const Project = sequelize.define('Project', {
        name: {
            type: DataTypes.STRING,
            allowNull: false,
            unique: true
        },
        slug: {
            type: DataTypes.STRING,
            allowNull: false,
            unique: true
        }
    }, {
        hooks: {
            beforeValidate: (project) => {
                if (project.name) {
                    project.slug = project.name
                        .toLowerCase()
                        .replace(/\s+/g, '-') // Substitui espaços por -
                        .replace(/[^\w\-]+/g, '') // Remove caracteres inválidos
                        .replace(/\-\-+/g, '-'); // Substitui múltiplos - por um único -
                }
            }
        }
    });
    return Project;
};

