const { Client, GatewayIntentBits, SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const axios = require('axios');
const sqlite3 = require('sqlite3').verbose();

// 🔧 CONFIGURAÇÕES - TUDO JÁ CONFIGURADO!
const config = {
    token: 'MTM4NzQ5MzU1MzI5NDI4MjgxMg.G8hD2W.aSi8AXQVxUmFeaAYi16PQNDyCzHDYPpGx8r2k4',
    clientId: '1387473552924282812',
    sites: {
        site1: {
            url: 'https://kiensueno.com',
            username: 'Drinko',
            password: 'AlKy 4Hao pRkB wsqN O0tA 9Vja'
        },
        site2: {
            url: 'https://cesartenorio.com',
            username: 'julio',
            password: 'd5V9 50Ye hcvF MDKm 5THl XLN2'
        }
    }
};

// 🤖 Inicializar cliente Discord
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

// 🗄️ Inicializar banco de dados
const db = new sqlite3.Database('likt_bot.db');

// 📋 Criar tabelas
db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS funnels (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT,
        username TEXT,
        title TEXT,
        original_link TEXT,
        pages TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        clicks INTEGER DEFAULT 0
    )`);
    
    db.run(`CREATE TABLE IF NOT EXISTS clicks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        funnel_id INTEGER,
        page_url TEXT,
        ip_address TEXT,
        user_agent TEXT,
        clicked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (funnel_id) REFERENCES funnels (id)
    )`);
});

// 🎨 Template do código do botão
const buttonTemplate = `
<style>
    @media not all and (hover: none) and (pointer: coarse) {
        .only-mobile {
            display: none !important;
        }
    }
    @media all and (hover: none) and (pointer: coarse) {
        .only-mobile {
            display: block !important;
        }
    }
</style>
<div class="only-mobile">
    <h3 style="text-align: center;">VOCÊ ENCONTRARÁ O <span style="color: #ff0000;">DOWNLOAD</span> LOGO ABAIXO</h3>
</div>
&nbsp;
<center>
<div id="countdown" style="font-weight: bold; font-size: 24px;">30 segundos</div>
<div style="text-align: center;">
    <a href="{{NEXT_URL}}">
        <button id="nextButton" style="display:none; background: #1a5276; border-radius: 0; padding: 10px 20px; cursor: pointer; color: #fff; border: none; font-size: 18px; font-weight: bold; box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2); transition: background-color 0.3s, transform 0.3s;">Próximo</button>
    </a>
</div>
<script>
    var seconds = 30;
    function countdown() {
        seconds--;
        if (seconds < 0) {
            if (isMobileDevice()) {
                document.getElementById("nextButton").style.display = "inline-block";
            }
            document.getElementById("countdown").style.display = "none";
        } else {
            document.getElementById("countdown").innerHTML = seconds + " segundos";
            setTimeout(countdown, 1000);
        }
    }
    countdown();
    function isMobileDevice() {
        return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    }
    if (!isMobileDevice()) {
        document.getElementById("countdown").style.display = "none";
        document.getElementById("nextButton").style.display = "none";
    }
    document.getElementById("nextButton").addEventListener("mouseover", function () {
        this.style.backgroundColor = "#154360";
        this.style.transform = "scale(1.05)";
    });
    document.getElementById("nextButton").addEventListener("mouseout", function () {
        this.style.backgroundColor = "#1a5276";
        this.style.transform = "scale(1)";
    });
</script>
</center>
`;

// 🔧 Função para criar página no WordPress
async function createWordPressPage(siteConfig, title, content) {
    try {
        const auth = Buffer.from(`${siteConfig.username}:${siteConfig.password}`).toString('base64');
        
        const response = await axios.post(`${siteConfig.url}/wp-json/wp/v2/pages`, {
            title: title,
            content: content,
            status: 'publish'
        }, {
            headers: {
                'Authorization': `Basic ${auth}`,
                'Content-Type': 'application/json'
            }
        });
        
        return response.data;
    } catch (error) {
        console.error('❌ Erro ao criar página:', error.response?.data || error.message);
        throw error;
    }
}

// 🚀 Função para criar funil completo
async function createFunnel(userId, username, title, originalLink) {
    const pages = [];
    let currentSite = 'site1';
    
    try {
        console.log(`🔄 Criando funil: ${title}`);
        
        // Criar 4 páginas (2 em cada site)
        for (let i = 1; i <= 4; i++) {
            const isLastPage = i === 4;
            const nextUrl = isLastPage ? originalLink : 'TEMP_NEXT_URL';
            
            const content = buttonTemplate.replace('{{NEXT_URL}}', nextUrl);
            const pageTitle = `${title} - Página ${i}`;
            
            const siteConfig = config.sites[currentSite];
            console.log(`📄 Criando página ${i} no ${currentSite}...`);
            
            const page = await createWordPressPage(siteConfig, pageTitle, content);
            
            pages.push({
                site: currentSite,
                url: page.link,
                id: page.id,
                title: pageTitle
            });
            
            console.log(`✅ Página ${i} criada: ${page.link}`);
            
            // Alternar entre sites
            currentSite = currentSite === 'site1' ? 'site2' : 'site1';
            
            // Aguardar um pouco entre criações
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
        
        // Atualizar URLs das páginas para criar o looping
        console.log('🔗 Atualizando links entre páginas...');
        for (let i = 0; i < pages.length - 1; i++) {
            const currentPage = pages[i];
            const nextPage = pages[i + 1];
            
            const updatedContent = buttonTemplate.replace('{{NEXT_URL}}', nextPage.url);
            
            // Atualizar a página com o URL correto
            const siteConfig = config.sites[currentPage.site];
            const auth = Buffer.from(`${siteConfig.username}:${siteConfig.password}`).toString('base64');
            
            await axios.post(`${siteConfig.url}/wp-json/wp/v2/pages/${currentPage.id}`, {
                content: updatedContent
            }, {
                headers: {
                    'Authorization': `Basic ${auth}`,
                    'Content-Type': 'application/json'
                }
            });
        }
        
        // Salvar no banco de dados
        return new Promise((resolve, reject) => {
            db.run(
                'INSERT INTO funnels (user_id, username, title, original_link, pages) VALUES (?, ?, ?, ?, ?)',
                [userId, username, title, originalLink, JSON.stringify(pages)],
                function(err) {
                    if (err) reject(err);
                    else {
                        console.log('💾 Funil salvo no banco de dados');
                        resolve({ id: this.lastID, pages });
                    }
                }
            );
        });
        
    } catch (error) {
        console.error('❌ Erro ao criar funil:', error);
        throw error;
    }
}

// 📊 Função para obter estatísticas do usuário
async function getUserStats(userId) {
    return new Promise((resolve, reject) => {
        db.all(
            'SELECT * FROM funnels WHERE user_id = ? ORDER BY created_at DESC',
            [userId],
            (err, rows) => {
                if (err) reject(err);
                else {
                    const totalFunnels = rows.length;
                    const totalClicks = rows.reduce((sum, row) => sum + row.clicks, 0);
                    resolve({ funnels: rows, totalFunnels, totalClicks });
                }
            }
        );
    });
}

// 📋 Comandos do bot
const commands = [
    new SlashCommandBuilder()
        .setName('criar-funil')
        .setDescription('Cria um funil de 4 páginas WordPress')
        .addStringOption(option =>
            option.setName('titulo')
                .setDescription('Título para as páginas do funil')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('link')
                .setDescription('Link final de destino')
                .setRequired(true)),
    
    new SlashCommandBuilder()
        .setName('dashboard')
        .setDescription('Mostra suas estatísticas e dashboard'),
    
    new SlashCommandBuilder()
        .setName('meus-funis')
        .setDescription('Lista todos os seus funis criados'),
    
    new SlashCommandBuilder()
        .setName('ajuda')
        .setDescription('Mostra como usar o bot')
];

// 🎯 Event listeners
client.once('ready', () => {
    console.log('🎉 LIKT BOT ONLINE!');
    console.log(`✅ Logado como: ${client.user.tag}`);
    console.log(`🌐 Conectado a ${client.guilds.cache.size} servidor(es)`);
    
    // Registrar comandos
    client.application.commands.set(commands);
    console.log('📋 Comandos registrados com sucesso!');
});

client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;
    
    const { commandName, user } = interaction;
    
    try {
        switch (commandName) {
            case 'criar-funil':
                await interaction.deferReply();
                
                const title = interaction.options.getString('titulo');
                const link = interaction.options.getString('link');
                
                // Validar URL
                try {
                    new URL(link);
                } catch {
                    return interaction.editReply('❌ URL inválida! Use um link válido (com http:// ou https://)');
                }
                
                try {
                    console.log(`🚀 Iniciando criação de funil para ${user.username}`);
                    const result = await createFunnel(user.id, user.username, title, link);
                    
                    const embed = new EmbedBuilder()
                        .setTitle('✅ Funil Criado com Sucesso!')
                        .setDescription(`**Título:** ${title}\n**Link Final:** ${link}`)
                        .addFields(
                            { name: '📊 Páginas Criadas', value: `${result.pages.length} páginas`, inline: true },
                            { name: '🔗 Primeira Página', value: `[Clique aqui](${result.pages[0].url})`, inline: true },
                            { name: '🎯 Fluxo', value: `${result.pages[0].site} → ${result.pages[1].site} → ${result.pages[2].site} → ${result.pages[3].site} → Link Final` }
                        )
                        .setColor('#00ff00')
                        .setTimestamp()
                        .setFooter({ text: 'LIKT BOT - Sistema de Funis' });
                    
                    await interaction.editReply({ embeds: [embed] });
                    
                } catch (error) {
                    console.error('❌ Erro ao criar funil:', error);
                    await interaction.editReply('❌ Erro ao criar funil. Verifique se os sites WordPress estão funcionando.');
                }
                break;
                
            case 'dashboard':
                await interaction.deferReply();
                
                try {
                    const stats = await getUserStats(user.id);
                    
                    const embed = new EmbedBuilder()
                        .setTitle('📊 Dashboard do Parceiro')
                        .setDescription(`Bem-vindo, **${user.username}**!\nAo sistema de criação automática de links!`)
                        .addFields(
                            { name: '📈 Total de Funis', value: `${stats.totalFunnels}`, inline: true },
                            { name: '👆 Total de Clicks', value: `${stats.totalClicks}`, inline: true },
                            { name: '📅 Último Funil', value: stats.funnels.length > 0 ? stats.funnels[0].title : 'Nenhum', inline: true }
                        )
                        .setColor('#0099ff')
                        .setTimestamp()
                        .setFooter({ text: 'LIKT BOT - Dashboard' });
                    
                    const row = new ActionRowBuilder()
                        .addComponents(
                            new ButtonBuilder()
                                .setCustomId('criar_funil')
                                .setLabel('📝 Criar Funil')
                                .setStyle(ButtonStyle.Primary),
                            new ButtonBuilder()
                                .setCustomId('ver_funis')
                                .setLabel('📋 Meus Funis')
                                .setStyle(ButtonStyle.Secondary)
                        );
                    
                    await interaction.editReply({ embeds: [embed], components: [row] });
                    
                } catch (error) {
                    console.error('❌ Erro ao buscar dashboard:', error);
                    await interaction.editReply('❌ Erro ao carregar dashboard.');
                }
                break;
                
            case 'meus-funis':
                await interaction.deferReply();
                
                try {
                    const stats = await getUserStats(user.id);
                    
                    if (stats.funnels.length === 0) {
                        return interaction.editReply('📭 Você ainda não criou nenhum funil.\n\nUse `/criar-funil` para começar!');
                    }
                    
                    const embed = new EmbedBuilder()
                        .setTitle('📋 Seus Funis')
                        .setColor('#0099ff')
                        .setFooter({ text: `Total: ${stats.funnels.length} funis` });
                    
                    stats.funnels.slice(0, 10).forEach((funnel, index) => {
                        const pages = JSON.parse(funnel.pages);
                        const createdDate = new Date(funnel.created_at).toLocaleDateString('pt-BR');
                        
                        embed.addFields({
                            name: `${index + 1}. ${funnel.title}`,
                            value: `**Clicks:** ${funnel.clicks} | **Criado:** ${createdDate}\n**Primeira página:** [Acessar](${pages[0].url})`,
                            inline: false
                        });
                    });
                    
                    await interaction.editReply({ embeds: [embed] });
                    
                } catch (error) {
                    console.error('❌ Erro ao buscar funis:', error);
                    await interaction.editReply('❌ Erro ao carregar funis.');
                }
                break;
                
            case 'ajuda':
                const helpEmbed = new EmbedBuilder()
                    .setTitle('🤖 LIKT BOT - Ajuda')
                    .setDescription('Sistema automatizado de criação de funis WordPress')
                    .addFields(
                        { 
                            name: '📝 /criar-funil', 
                            value: 'Cria um funil de 4 páginas alternando entre seus sites\n**Exemplo:** `/criar-funil titulo:Meu Produto link:https://meusite.com`' 
                        },
                        { 
                            name: '📊 /dashboard', 
                            value: 'Mostra suas estatísticas e resumo de atividade' 
                        },
                        { 
                            name: '📋 /meus-funis', 
                            value: 'Lista todos os funis que você criou' 
                        },
                        { 
                            name: '🔄 Como funciona o funil:', 
                            value: '1️⃣ kiensueno.com (30s) → 2️⃣ cesartenorio.com (30s) → 3️⃣ kiensueno.com (30s) → 4️⃣ cesartenorio.com (30s) → Seu Link' 
                        }
                    )
                    .setColor('#ffa500')
                    .setFooter({ text: 'LIKT BOT v1.0' });
                
                await interaction.reply({ embeds: [helpEmbed] });
                break;
        }
        
    } catch (error) {
        console.error('❌ Erro no comando:', error);
        if (interaction.deferred) {
            await interaction.editReply('❌ Erro interno do bot. Tente novamente.');
        } else {
            await interaction.reply('❌ Erro interno do bot. Tente novamente.');
        }
    }
});

// 🔘 Tratar cliques nos botões
client.on('interactionCreate', async interaction => {
    if (!interaction.isButton()) return;
    
    if (interaction.customId === 'criar_funil') {
        await interaction.reply({
            content: '📝 Para criar um novo funil, use o comando:\n```/criar-funil titulo:Seu Título link:https://seulink.com```',
            ephemeral: true
        });
    } else if (interaction.customId === 'ver_funis') {
        await interaction.reply({
            content: '📋 Para ver seus funis, use o comando:\n```/meus-funis```',
            ephemeral: true
        });
    }
});

// 🚀 Inicializar bot
client.login(config.token).catch(console.error);

console.log('🔄 Iniciando LIKT BOT...');
console.log('📡 Conectando ao Discord...');
