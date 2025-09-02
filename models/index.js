const { Sequelize } = require('sequelize');
const path = require('path');
require('dotenv').config(); // Adiciona suporte para variáveis de ambiente locais

let sequelize;

// Verifica se está em ambiente de produção (com a variável DATABASE_URL)
if (process.env.DATABASE_URL) {
    // Configuração para produção (Easypanel)
    sequelize = new Sequelize(process.env.DATABASE_URL, {
        dialect: 'postgres',
        protocol: 'postgres',
        logging: false,
        dialectOptions: {
            ssl: {
                require: true,
                rejectUnauthorized: false // Necessário para muitas plataformas de cloud
            }
        }
    });
} else {
    // Configuração para desenvolvimento local (SQLite)
    sequelize = new Sequelize({
        dialect: 'sqlite',
        storage: path.join(__dirname, '../database/database.sqlite'),
        logging: false
    });
}


// --- O resto do ficheiro permanece exatamente igual ---

try {
    // Import models
    const Project = require('./Project')(sequelize, Sequelize.DataTypes);
    const ApiSpec = require('./ApiSpec')(sequelize, Sequelize.DataTypes);
    const ProjectVersion = require('./ProjectVersion')(sequelize, Sequelize.DataTypes);
    const VersionAssociation = require('./VersionAssociation')(sequelize, Sequelize.DataTypes);

    // Define relationships
    Project.hasMany(ProjectVersion, { onDelete: 'CASCADE' });
    ProjectVersion.belongsTo(Project);

    ProjectVersion.hasMany(VersionAssociation, { onDelete: 'CASCADE' });
    VersionAssociation.belongsTo(ProjectVersion);

    ApiSpec.hasMany(VersionAssociation, { onDelete: 'CASCADE' });
    VersionAssociation.belongsTo(ApiSpec);

    const db = {
        sequelize,
        Project,
        ApiSpec,
        ProjectVersion,
        VersionAssociation
    };
    
    module.exports = db;

} catch (error) {
    console.error('--- [ERRO FATAL] Ocorreu um erro ao carregar os modelos da base de dados:', error);
    process.exit(1); 
}