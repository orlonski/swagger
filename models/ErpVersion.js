// Ficheiro: models/ErpVersion.js
// Responsabilidade: Definir a estrutura da tabela 'ErpVersions' na base de dados.

module.exports = (sequelize, DataTypes) => {
    const ErpVersion = sequelize.define('ErpVersion', {
        name: {
            type: DataTypes.STRING,
            allowNull: false,
            unique: true
        }
    });
    return ErpVersion;
};
