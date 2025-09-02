const { Sequelize, DataTypes } = require('sequelize');

let sequelize;

if (process.env.DATABASE_URL) {
    sequelize = new Sequelize(process.env.DATABASE_URL, {
        dialect: 'postgres',
        protocol: 'postgres',
        logging: false,
        dialectOptions: {
            ssl: {
                require: true,
                rejectUnauthorized: false
            }
        }
    });
} else {
    // Fallback para SQLite para desenvolvimento local, se necessário
    sequelize = new Sequelize({
        dialect: 'sqlite',
        storage: path.join(__dirname, '../database/database.sqlite'),
        logging: false
    });
}

const db = {};

// Carregar modelos
db.Project = require('./Project')(sequelize, DataTypes);
db.ApiSpec = require('./ApiSpec')(sequelize, DataTypes);
db.ProjectVersion = require('./ProjectVersion')(sequelize, DataTypes);
db.VersionAssociation = require('./VersionAssociation')(sequelize, DataTypes);

// Definir associações
db.Project.hasMany(db.ProjectVersion, { onDelete: 'CASCADE' });
db.ProjectVersion.belongsTo(db.Project);

db.ProjectVersion.hasMany(db.VersionAssociation, { onDelete: 'CASCADE' });
db.VersionAssociation.belongsTo(db.ProjectVersion);

db.ApiSpec.hasMany(db.VersionAssociation, { onDelete: 'CASCADE' });
db.VersionAssociation.belongsTo(db.ApiSpec);

db.sequelize = sequelize;
db.Sequelize = Sequelize;

module.exports = db;