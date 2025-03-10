// Создаем сцену загрузки (прелоадер)
class PreloadScene extends Phaser.Scene {
    constructor() {
        super({ key: 'PreloadScene' });
    }

    preload() {
        // Загружаем фон и изображения
        this.load.image('background', 'assets/background.png'); // Фон
        this.load.image('chef_hat', 'assets/chef_hat.svg'); // Шапка повара

        // Загружаем остальные ресурсы игры
        this.load.image('button', 'assets/button.png');
        this.load.image('title', 'assets/title.png');
        this.load.image('icon_play', 'assets/icon_play.png');
        this.load.image('icon_settings', 'assets/icon_settings.png');

        // Загружаем музыку
        this.load.audio('bg_music', 'assets/song.mp3');

        // Фейковая загрузка для имитации процесса 1–100%
        for (let i = 0; i < 100; i++) {
            this.load.image(`fake${i}`, 'assets/background.png');
        }
    }

    create() {
        // Устанавливаем фон
        this.add.image(220, 478, 'background').setScale(1);

        // Добавляем шапку повара по центру
        let chefHat = this.add.image(220, 350, 'chef_hat').setScale(1);

        // Анимация шапки (тряска вверх-вниз)
        this.tweens.add({
            targets: chefHat,
            y: 360,
            duration: 500,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });

        // Линия загрузки (фон)
        let progressBarBg = this.add.graphics();
        progressBarBg.fillStyle(0x555555, 0.3);
        progressBarBg.fillRect(120, 500, 200, 10);

        // Линия загрузки (сам прогресс)
        let progressBar = this.add.graphics();

        // Текст прогресса (по центру)
        let progressText = this.add.text(220, 530, "1%", {
            fontSize: '24px',
            fill: '#FFFFFF',
            fontFamily: 'Montserrat',
            fontWeight: '600'
        }).setOrigin(0.5);

        // Симуляция загрузки 1-100% за 5 секунд
        let progress = 1;
        let interval = setInterval(() => {
            progress++;
            progressText.setText(progress + "%");

            progressBar.clear();
            progressBar.fillStyle(0xFFFFFF, 1);
            progressBar.fillRect(120, 500, (progress / 100) * 200, 10);

            if (progress >= 100) {
                clearInterval(interval);
                this.scene.start('MainMenuScene');
            }
        }, 50);
    }
}

// Создаем сцену главного меню
class MainMenuScene extends Phaser.Scene {
    constructor() {
        super({ key: 'MainMenuScene' });
    }

    create() {
        this.add.image(220, 478, 'background').setScale(1);
        let title = this.add.image(220, 250, 'title').setScale(1);
        let startY = title.y + title.height / 2 + 30;
    
        this.createButton(220, startY, "Play", "icon_play", () => {
            console.log("Play button clicked!");
            this.scene.start("GameScene"); // Загружаем игру
        });
        
    
        this.createButton(220, startY + 60, "Settings", 'icon_settings', () => {
            console.log("Settings button clicked!");
            this.showSettingsPopup(); // Вызываем popup
        });
        
        
    
        this.createButton(220, startY + 120, "About Us", null, () => {
            console.log("About Us button clicked!");
            this.showPopup(); // Вызываем popup
        });
        
    
        this.createButton(220, startY + 180, "Quit", null, () => {
            console.log("Quit button clicked!");
            this.quitGame(); // Теперь метод вызывается правильно!
        });
    
        this.add.text(220, 920, "v 0.01", {
            fontSize: '18px',
            fill: '#FFFFFF',
            fontFamily: 'Montserrat',
            fontWeight: '400'
        }).setOrigin(0.5);
    
        // Запускаем музыку, если она еще не играет
        if (!this.music) {
            this.music = this.sound.add('bg_music', { loop: true, volume: 0.5 });
            this.music.play();
        }
        
    }

    createButton(x, y, text, iconKey, callback) {
        let button = this.add.image(x, y, 'button').setInteractive({ useHandCursor: true }).setScale(0.85);
        let container = this.add.container(x, y);
        let buttonText = this.add.text(0, 0, text, {
            fontSize: '32px',
            fill: '#A04F32',
            fontFamily: 'Montserrat',
            fontWeight: '600'
        }).setOrigin(0.5);

        let icon = null;
        if (iconKey) {
            icon = this.add.image(-buttonText.width / 2 - 15, 0, iconKey).setDisplaySize(24, 24);
            container.add(icon);
        }

        container.add(buttonText);
        container.setDepth(1);

        // Анимация при наведении
        button.on('pointerover', () => {
            document.body.style.cursor = 'pointer';
            this.tweens.add({
                targets: button,
                scale: 0.9,
                duration: 150,
                ease: 'Sine.easeInOut'
            });

            this.tweens.add({
                targets: [buttonText, icon].filter(el => el),
                scale: 1.05,
                duration: 150,
                ease: 'Sine.easeInOut'
            });
        });

        // Анимация при уходе
        button.on('pointerout', () => {
            document.body.style.cursor = 'default';
            this.tweens.add({
                targets: button,
                scale: 0.85,
                duration: 150,
                ease: 'Sine.easeInOut'
            });

            this.tweens.add({
                targets: [buttonText, icon].filter(el => el),
                scale: 1,
                duration: 150,
                ease: 'Sine.easeInOut'
            });
        });

        button.on('pointerdown', callback);
    }

    quitGame() {
        if (typeof navigator !== 'undefined' && navigator.app) {
            // Android/iOS (Cordova, Capacitor)
            navigator.app.exitApp();
        } else if (window.YaGames) {
            // Яндекс Игры
            window.YaGames.init().then(ysdk => {
                ysdk.exit();
            });
        } else {
            // Для браузера (тестирование)
            window.location.reload();
        }
    }

    showPopup() {
        // Создаем контейнер для попапа
        let popupContainer = this.add.container(0, 0).setDepth(999); // Устанавливаем z-index выше всех
    
        // Фон попапа
        let popupBg = this.add.graphics();
        popupBg.fillStyle(0xFFF7C6, 1);
        popupBg.fillRoundedRect(50, 250, 340, 400, 20); // Скругленные углы
    
        popupContainer.add(popupBg);
    
        // Текст в центре попапа
        let popupText = this.add.text(220, 400, 
            "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Nulla facilisi. Sed at lacus vel nisi suscipit ultrices.", {
            fontSize: "18px",
            fill: "#A04F32",
            fontFamily: "Montserrat",
            fontWeight: "600",
            align: "center",
            wordWrap: { width: 300 }
        }).setOrigin(0.5);
    
        popupContainer.add(popupText);
    
        // Кнопка закрытия (вверху по центру)
        let closeButton = this.add.text(220, 270, "✖", {
            fontSize: "28px",
            fill: "#A04F32",
            fontFamily: "Montserrat",
            fontWeight: "bold"
        }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    
        closeButton.on("pointerdown", () => {
            popupContainer.destroy(); // Удаляем popup
        });
    
        popupContainer.add(closeButton);
    }
    
    showSettingsPopup() {
        let popupContainer = this.add.container(0, 0).setDepth(999); // Выше всех
    
        // Создаем фон попапа
        let popupBg = this.add.graphics();
        popupBg.fillStyle(0xFFF7C6, 1);
        let popupBgRect = popupBg.fillRoundedRect(50, 300, 340, 200, 20); // Скругленные углы
        popupContainer.add(popupBg);
    
        // Заголовок "Музыка"
        let popupText = this.add.text(220, 350, "Музыка", {
            fontSize: "24px",
            fill: "#A04F32",
            fontFamily: "Montserrat",
            fontWeight: "600",
            align: "center"
        }).setOrigin(0.5);
        popupContainer.add(popupText);
    
        // Получаем текущее состояние музыки
        let music = this.sound.get('bg_music');
        let isMusicOn = music?.isPlaying ?? false;
    
        // Кнопка включения музыки (ON)
        let musicOnButton = this.add.text(160, 420, "ON", {
            fontSize: "22px",
            fill: "#A04F32",
            fontFamily: "Montserrat",
            fontWeight: "bold",
            backgroundColor: "#FFFFFF",
            padding: { x: 10, y: 5 }
        }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    
        musicOnButton.on("pointerdown", () => {
            console.log("Music ON clicked!");
            this.toggleMusic(true);
            popupBg.clear();
            popupBg.fillStyle(0xFFF7C6, 1); // Возвращаем оригинальный фон
            popupBg.fillRoundedRect(50, 300, 340, 200, 20);
        });
    
        popupContainer.add(musicOnButton);
    
        // Кнопка выключения музыки (OFF)
        let musicOffButton = this.add.text(280, 420, "OFF", {
            fontSize: "22px",
            fill: "#A04F32",
            fontFamily: "Montserrat",
            fontWeight: "bold",
            backgroundColor: "#FFFFFF",
            padding: { x: 10, y: 5 }
        }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    
        musicOffButton.on("pointerdown", () => {
            console.log("Music OFF clicked!");
            this.toggleMusic(false);
            popupBg.clear();
            popupBg.fillStyle(0xFFD4A3, 1); // Меняем фон при выключении
            popupBg.fillRoundedRect(50, 300, 340, 200, 20);
        });
    
        popupContainer.add(musicOffButton);
    
        // Кнопка закрытия (по центру сверху)
        let closeButton = this.add.text(220, 320, "✖", {
            fontSize: "28px",
            fill: "#A04F32",
            fontFamily: "Montserrat",
            fontWeight: "bold"
        }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    
        closeButton.on("pointerdown", () => {
            popupContainer.destroy(); // Удаляем popup
        });
    
        popupContainer.add(closeButton);
    }
    
    
    
    
    toggleMusic(enable) {
        let music = this.sound.get('bg_music');
        if (!music) return;
    
        if (enable) {
            if (!music.isPlaying) music.play();
        } else {
            if (music.isPlaying) music.stop();
        }
    }
    
    
    
    
    
}



const config = {
    type: Phaser.AUTO,
    scale: {
        mode: Phaser.Scale.FIT,
        parent: 'game-container',
        width: 440,
        height: window.innerHeight,
        autoCenter: Phaser.Scale.CENTER_BOTH
    },
    scene: [PreloadScene, MainMenuScene, GameScene],
};

// Обновляем размеры при изменении окна
window.addEventListener('resize', function() {
    if (game) {
        game.scale.resize(440, window.innerHeight);
    }
});

window.game = new Phaser.Game(config);
