const { Sequelize, DataTypes } = require('sequelize');
const path = require('path');

let sequelize;

// Oracle Database Configuration - usando dados fixos da memória
const connectionString = `(DESCRIPTION = (ADDRESS_LIST = (ADDRESS = (PROTOCOL = TCP)(HOST = o06.kmm.dev.br)(PORT = 1521))) (CONNECT_DATA = (SID = O06B02)))`;

sequelize = new Sequelize('', 'kmmupdate', 'Kww$#2025', {
    host: 'o06.kmm.dev.br',
    port: 1521,
    dialect: 'oracle',
    dialectOptions: {
        connectString: connectionString
    },
    logging: false,
    pool: {
        max: 10,
        min: 0,
        acquire: 30000,
        idle: 10000
    },
    // Desabilitar todos os tipos de cache
    cache: false,
    query: {
        cache: false
    },
    benchmark: true,
    retry: {
        match: [],
        max: 0
    }
});

const db = {};

// Carregar modelos
db.Project = require('./Project')(sequelize, DataTypes);
db.ApiSpec = require('./ApiSpec')(sequelize, DataTypes);
db.ProjectVersion = require('./ProjectVersion')(sequelize, DataTypes);
db.VersionAssociation = require('./VersionAssociation')(sequelize, DataTypes);

// Definir associações Oracle
db.Project.hasMany(db.ProjectVersion, { 
    foreignKey: 'cod_modulo', 
    sourceKey: 'cod_modulo',
    onDelete: 'CASCADE' 
});
db.ProjectVersion.belongsTo(db.Project, { 
    foreignKey: 'cod_modulo', 
    targetKey: 'cod_modulo' 
});

db.ProjectVersion.hasMany(db.VersionAssociation, { 
    foreignKey: ['cliente_id', 'cod_modulo'],
    onDelete: 'CASCADE' 
});
db.VersionAssociation.belongsTo(db.ProjectVersion, { 
    foreignKey: ['cliente_id', 'cod_modulo']
});

db.ApiSpec.hasMany(db.VersionAssociation, { 
    foreignKey: 'api_spec_id',
    onDelete: 'CASCADE' 
});
db.VersionAssociation.belongsTo(db.ApiSpec, { 
    foreignKey: 'api_spec_id'
});

db.sequelize = sequelize;
db.Sequelize = Sequelize;

module.exports = db;