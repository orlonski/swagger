const { sequelize } = require('./models');

async function findCorrectTable() {
    try {
        console.log('=== Procurando a tabela correta com dados de API specs ===\n');
        
        // 1. Listar todas as tabelas no schema KMM
        console.log('1. Listando todas as tabelas no schema KMM...');
        const [allTables] = await sequelize.query(`
            SELECT table_name FROM all_tables WHERE owner = 'KMM' ORDER BY table_name
        `);
        
        console.log(`   Total de tabelas: ${allTables.length}`);
        
        // 2. Procurar tabelas que possam conter specs/APIs
        const possibleTables = allTables.filter(t => 
            t.TABLE_NAME.includes('SPEC') || 
            t.TABLE_NAME.includes('API') || 
            t.TABLE_NAME.includes('YAML') ||
            t.TABLE_NAME.includes('SWAGGER')
        );
        
        console.log('\n2. Tabelas que podem conter specs:');
        possibleTables.forEach(table => {
            console.log(`   - ${table.TABLE_NAME}`);
        });
        
        // 3. Verificar estrutura e dados de cada tabela possível
        for (const table of possibleTables) {
            console.log(`\n3. Verificando tabela: ${table.TABLE_NAME}`);
            
            try {
                // Verificar colunas
                const [columns] = await sequelize.query(`
                    SELECT column_name, data_type FROM all_tab_columns 
                    WHERE owner = 'KMM' AND table_name = '${table.TABLE_NAME}'
                    ORDER BY column_id
                `);
                
                console.log('   Colunas:');
                columns.forEach(col => {
                    console.log(`     - ${col.COLUMN_NAME}: ${col.DATA_TYPE}`);
                });
                
                // Contar registros
                const [countResult] = await sequelize.query(`
                    SELECT COUNT(*) as count FROM kmm.${table.TABLE_NAME}
                `);
                console.log(`   Registros: ${countResult[0].COUNT}`);
                
                // Se tem registros, mostrar alguns exemplos
                if (countResult[0].COUNT > 0) {
                    const [samples] = await sequelize.query(`
                        SELECT * FROM kmm.${table.TABLE_NAME} WHERE ROWNUM <= 3
                    `);
                    console.log('   Exemplos de dados:');
                    samples.forEach((row, index) => {
                        console.log(`     Registro ${index + 1}:`, row);
                    });
                }
                
            } catch (error) {
                console.log(`   ❌ Erro ao acessar tabela: ${error.message}`);
            }
        }
        
    } catch (error) {
        console.error('❌ Erro durante busca:', error.message);
    } finally {
        await sequelize.close();
    }
}

findCorrectTable();
