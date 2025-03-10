class GameScene extends Phaser.Scene {
    constructor() {
        super({ key: 'GameScene' });
        this.selectedItem = null;
        this.isDragging = false;
        this.audioInitialized = false;
        // Добавляем счетчики для каждого типа item
        this.itemCounts = {
            item1: 0,
            item2: 0,
            item3: 0,
            item4: 0,
            item5: 0
        };
        this.gearCount = 2; // Начальное количество шестеренок
    }

    preload() {
        this.load.image("background", "assets/background.png");
        this.load.image("tile", "assets/tile.png");
        this.load.image("item1", "assets/item1.png");
        this.load.image("item2", "assets/item2.png");
        this.load.image("item3", "assets/item3.png");
        this.load.image("item4", "assets/item4.png");
        this.load.image("item5", "assets/item5.png");
        this.load.image("gear", "assets/gear.png");
        this.load.image("bomb", "assets/bomb.png");
        this.load.image("game_setting", "assets/game_setting.png");
        this.load.audio("bg_music", "assets/song.mp3");
        this.load.image("level_background", "assets/level_background.png");
        this.load.image("match_background", "assets/match_background.png");
        this.load.image('particle', 'assets/particle.png'); // Добавьте изображение частицы

        // Создаем частицу программно, если нет изображения
        const graphics = this.add.graphics();
        graphics.fillStyle(0xffffff, 1);
        graphics.fillCircle(4, 4, 4);
        graphics.generateTexture('particle', 8, 8);
        graphics.destroy();
    }

    create() {
        this.add.image(220, 478, "background").setScale(1);
        this.gridSize = 7;
        this.tileSize = 50;
        this.items = ["item1", "item2", "item3", "item4", "item5"];
        this.grid = [];
        let centerX = this.cameras.main.width / 2;
        let centerY = this.cameras.main.height / 2;
        let gridWidth = this.gridSize * this.tileSize;
        let gridHeight = this.gridSize * this.tileSize;
        let offsetX = centerX - gridWidth / 2 + this.tileSize / 2;
        let offsetY = centerY - gridHeight / 2 + this.tileSize / 2;
        // Создаем контейнер для всей сетки
        let gridContainer = this.add.container(centerX, centerY).setDepth(1);

        // Фон
        let gridBg = this.add.graphics();
        gridBg.fillStyle(0xFFF7C6, 1);
        gridBg.fillRoundedRect(-gridWidth / 2, -gridHeight / 2, gridWidth, gridHeight, 10);
        gridContainer.add(gridBg);

        // Добавляем клетки и элементы внутрь контейнера
        for (let row = 0; row < this.gridSize; row++) {
            this.grid[row] = [];
            for (let col = 0; col < this.gridSize; col++) {
                let x = offsetX + col * this.tileSize;
                let y = offsetY + row * this.tileSize;

                let tile = this.add.image(x, y, "tile").setScale(0.8).setOrigin(0.5).setDepth(1);
                
                // Получаем случайный элемент, который не создаст совпадение
                let itemType = this.getRandomValidItem(row, col);
                
                let item = this.add.image(x, y, itemType)
                    .setDisplaySize(37, 37)
                    .setOrigin(0.5)
                    .setInteractive({ useHandCursor: true, draggable: true })
                    .setDepth(2);

                this.grid[row][col] = { 
                    tile, 
                    item, 
                    type: itemType, 
                    row,
                    col 
                };
            }
        }

        // Обработчик кликов на элементах
        this.input.on("gameobjectdown", (pointer, gameObject) => {
            if (gameObject.texture && this.items.includes(gameObject.texture.key)) {
                console.log("🖱️ Клик по объекту:", gameObject.texture.key);
                this.selectItem(gameObject);
            }
        });

        // Делаем все элементы сетки перетаскиваемыми
        this.input.setDraggable(this.grid.flat().map(cell => cell.item));

        // Единый обработчик перетаскивания
        this.input.on("dragstart", (pointer, gameObject) => {
            if (!gameObject.texture || !this.items.includes(gameObject.texture.key) || this.isDragging) return;
            
            console.log("🎯 Начало перетаскивания:", gameObject.texture.key);
            this.isDragging = true;
            this.dragStartPos = { x: gameObject.x, y: gameObject.y };
            this.selectItem(gameObject);
            gameObject.setDepth(4);
        });

        this.input.on("drag", (pointer, gameObject, dragX, dragY) => {
            if (!this.isDragging || !gameObject.texture) return;
            
            // Ограничиваем область перетаскивания
            const cell = this.findCellByItem(gameObject);
            if (!cell) return;

            const maxDistance = this.tileSize * 1.2; // Максимальное расстояние перетаскивания
            const dx = dragX - this.dragStartPos.x;
            const dy = dragY - this.dragStartPos.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance <= maxDistance) {
                gameObject.x = dragX;
                gameObject.y = dragY;
            }
        });

        this.input.on("dragend", async (pointer, gameObject) => {
            if (!this.isDragging || !gameObject.texture) return;
            
            console.log("🎮 Конец перетаскивания:", gameObject.texture.key);
            this.isDragging = false;
            gameObject.setDepth(2);
            
            const sourceCell = this.findCellByItem(gameObject);
            const targetCell = this.findNearestCell(gameObject.x, gameObject.y);
            
            if (!sourceCell || !targetCell) {
                console.log("❌ Не удалось найти ячейки для обмена");
                await this.resetPosition(gameObject);
                return;
            }

            if (sourceCell === targetCell) {
                console.log("❌ Элемент остался в той же ячейке");
                await this.resetPosition(gameObject);
                return;
            }

            if (this.isAdjacent(sourceCell, targetCell)) {
                console.log("✅ Выполняем обмен элементов");
                await this.swapItems(sourceCell, targetCell);
                this.time.delayedCall(250, () => this.checkMatches());
            } else {
                console.log("❌ Ячейки не являются соседними");
                await this.resetPosition(gameObject);
            }
        });

        // Включаем музыку
        this.music = this.sound.get("bg_music"); // Проверяем, есть ли музыка
        if (!this.music) {
            this.music = this.sound.add("bg_music", { loop: true, volume: 0.5 });
            this.music.play();
        }

        // Добавляем фон для уровня
        this.add.image(50, 50, "level_background")
            .setDisplaySize(79, 79)
            .setDepth(1);

        // Цифра уровня с новым цветом
        this.levelText = this.add.text(50, 50, "1", {
            fontSize: "36px",
            fill: "#A04F32",  // меняем цвет на коричневый
            fontFamily: "Montserrat",
            fontWeight: "600",
            lineHeight: 1
        }).setOrigin(0.5).setDepth(2);

        // Добавляем фон для счетчиков matches по центру
        this.add.image(240, 50, "match_background")
            .setDisplaySize(200, 50)
            .setDepth(1);

        // Обновляем счетчики разбитых items по центру
        const startX = 160;  // уменьшаем начальную позицию (было 165)
        const spacing = 40;  // расстояние между иконками
        const iconY = 50;    // Y координата иконок
        const textY = 90;    // Y координата текста

        this.items.forEach((itemKey, index) => {
            // Добавляем иконку item с меньшим размером
            this.add.image(startX + (spacing * index), iconY, itemKey)
                .setDisplaySize(25, 25)
                .setDepth(2);

            // Добавляем текст с количеством
            this.add.text(startX + (spacing * index), textY, "0", {
                fontSize: "24px",
                fill: "#FFFFFF",
                fontFamily: "Montserrat",
                fontWeight: "600",
                lineHeight: 1,
                align: "center"
            }).setOrigin(0.5).setName(`${itemKey}_count`);
        });

        // Добавляем UI элементы
        this.settingsButton = this.add.image(390, 50, "game_setting")
            .setInteractive({ useHandCursor: true })
            .on('pointerdown', () => this.showMusicPopup())
            .setDepth(1);

        this.settingsButton.on("pointerdown", () => {
            console.log("Game Settings button clicked!");
            this.showMusicPopup();
        });

        // Добавляем иконки и счетчики внизу
        // Шестеренка
        const gearButton = this.add.image(150, 850, "gear")
            .setScale(0.8)
            .setDepth(1)
            .setInteractive({ useHandCursor: true });

        this.gearCountText = this.add.text(150, 890, this.gearCount.toString(), {
            fontSize: "24px",
            fill: "#FFFFFF",
            fontFamily: "Montserrat",
            fontWeight: "600",
            lineHeight: 1,
            align: "center"
        }).setOrigin(0.5);

        gearButton.on('pointerdown', () => {
            if (this.gearCount > 0) {
                this.showGearSelectionMode();
            }
        });

        // Бомба
        this.bombCount = 5; // Добавляем начальное количество бомб
        console.log("Initial bomb count:", this.bombCount);

        const bombButton = this.add.image(250, 850, "bomb")
            .setScale(0.8)
            .setDepth(1)
            .setInteractive({ useHandCursor: true });
        
        bombButton.on('pointerdown', () => {
            console.log("Bomb button clicked!");
            console.log("Current bomb count:", this.bombCount);
            this.showBombSelectionPopup();
        });
        
        this.bombCountText = this.add.text(250, 890, this.bombCount.toString(), {
            fontSize: "24px",
            fill: "#FFFFFF",
            fontFamily: "Montserrat",
            fontWeight: "600",
            lineHeight: 1,
            align: "center"
        }).setOrigin(0.5);

        // Добавляем таймер
        this.timeLeft = 15;
        this.timer = this.time.addEvent({
            delay: 1000,
            callback: this.updateTimer,
            callbackScope: this,
            loop: true
        });

        // Инициализация переменных для управления перетаскиванием
        this.isDragging = false;
        this.dragStartPos = { x: 0, y: 0 };
        
        // Обработка взаимодействия с элементами
        this.grid.flat().forEach(cell => {
            if (cell.item) {
                cell.item
                    .setInteractive({ draggable: true })
                    .on('dragstart', (pointer) => {
                        this.handleDragStart(pointer, cell.item);
                    })
                    .on('drag', (pointer) => {
                        this.handleDrag(pointer, cell.item);
                    })
                    .on('dragend', (pointer) => {
                        this.handleDragEnd(pointer, cell.item);
                    })
                    .on('pointerdown', () => {
                        this.selectItem(cell.item);
                    });
            }
        });
    }

    handleItemClick(cell) {
        if (this.isDragging) return;
        
        const clickedItem = cell.item;
        if (!clickedItem) return;

        if (this.selectedItem) {
            if (this.selectedItem === clickedItem) {
                this.clearSelection();
                return;
            }

            const selectedCell = this.findCellByItem(this.selectedItem);
            if (selectedCell && this.isAdjacent(selectedCell, cell)) {
                this.swapItems(selectedCell, cell);
                this.clearSelection();
            } else {
                this.clearSelection();
                this.selectItem(clickedItem);
            }
        } else {
            this.selectItem(clickedItem);
        }
    }

    setupItemInteraction(cell) {
        if (!cell.item) return;

        cell.item
            .setInteractive({ draggable: true })
            .removeAllListeners()
            .on('pointerdown', () => {
                if (!this.isDragging) {
                    this.handleItemClick(cell);
                }
            })
            .on('dragstart', (pointer, dragX, dragY) => {
                this.isDragging = true;
                cell.item.setDepth(3);
                this.selectItem(cell.item);
            })
            .on('drag', (pointer, dragX, dragY) => {
                if (this.isDragging) {
                    cell.item.x = pointer.x;
                    cell.item.y = pointer.y;
                }
            })
            .on('dragend', () => {
                if (!this.isDragging) return;

                const targetCell = this.findNearestCell(cell.item.x, cell.item.y);
                const sourceCell = this.findCellByItem(cell.item);

                cell.item.setDepth(2);

                if (targetCell && 
                    targetCell !== sourceCell && 
                    this.isAdjacent(sourceCell, targetCell)) {
                    this.swapItems(sourceCell, targetCell);
                } else {
                    this.resetPosition(cell.item);
                }

                this.isDragging = false;
                this.clearSelection();
            });
    }

    findNearestCell(x, y) {
        let nearestCell = null;
        let minDistance = Infinity;

        this.grid.flat().forEach(cell => {
            if (!cell.tile) return;
            
            const distance = Phaser.Math.Distance.Between(
                x, y,
                cell.tile.x, cell.tile.y
            );

            if (distance < minDistance) {
                minDistance = distance;
                nearestCell = cell;
            }
        });

        // Проверяем, находится ли точка в пределах допустимого расстояния
        return minDistance <= this.tileSize ? nearestCell : null;
    }

    isAdjacent(cell1, cell2) {
        if (!cell1 || !cell2) return false;
        
        const rowDiff = Math.abs(cell1.row - cell2.row);
        const colDiff = Math.abs(cell1.col - cell2.col);
        
        return (rowDiff === 1 && colDiff === 0) || (rowDiff === 0 && colDiff === 1);
    }

    findGridPosition(cell) {
        for (let row = 0; row < this.gridSize; row++) {
            for (let col = 0; col < this.gridSize; col++) {
                if (this.grid[row][col] === cell) {
                    return { row, col };
                }
            }
        }
        return null;
    }

    handleDragStart(pointer, gameObject) {
        if (this.isDragging) return;
        
        this.isDragging = true;
        this.dragStartPos = { x: gameObject.x, y: gameObject.y };
        gameObject.setDepth(4);
        
        console.log("🎯 Начало перетаскивания:", gameObject.texture.key);
    }

    handleDrag(pointer, gameObject) {
        if (!this.isDragging) return;
        
        const cell = this.findCellByItem(gameObject);
        if (!cell) return;

        // Получаем начальные координаты
        const startX = cell.tile.x;
        const startY = cell.tile.y;
        
        // Вычисляем максимальное расстояние перемещения
        const maxDistance = this.tileSize;
        
        // Вычисляем новые координаты с ограничениями
        let newX = Phaser.Math.Clamp(
            pointer.x,
            startX - maxDistance,
            startX + maxDistance
        );
        
        let newY = Phaser.Math.Clamp(
            pointer.y,
            startY - maxDistance,
            startY + maxDistance
        );
        
        // Определяем основное направление движения
        const deltaX = Math.abs(pointer.x - startX);
        const deltaY = Math.abs(pointer.y - startY);
        
        // Если движение преимущественно горизонтальное
        if (deltaX > deltaY) {
            newY = startY; // Запрещаем вертикальное движение
        } else {
            newX = startX; // Запрещаем горизонтальное движение
        }
        
        // Применяем новые координаты
        gameObject.x = newX;
        gameObject.y = newY;
    }

    handleDragEnd(pointer, gameObject) {
        if (!this.isDragging) return;
        
        console.log("🎮 Конец перетаскивания:", gameObject.texture.key);
        
        this.isDragging = false;
        gameObject.setDepth(2);
        
        // Очищаем выделение
        this.clearSelection();
        
        const sourceCell = this.findCellByItem(gameObject);
        const targetCell = this.findNearestCell(gameObject.x, gameObject.y);
        
        if (!sourceCell || !targetCell) {
            console.log("❌ Не удалось найти ячейки для обмена");
            this.resetPosition(gameObject);
            return;
        }

        if (sourceCell === targetCell) {
            console.log("❌ Элемент остался в той же ячейке");
            this.resetPosition(gameObject);
            return;
        }

        // Проверяем, что обмен происходит только с соседней ячейкой
        if (this.isAdjacent(sourceCell, targetCell)) {
            console.log("✅ Выполняем обмен элементов");
            
            // Временно блокируем взаимодействие со всеми элементами
            this.grid.flat().forEach(cell => {
                if (cell.item && cell.item.input) {
                    cell.item.input.enabled = false;
                }
            });
            
            this.swapItems(sourceCell, targetCell).then(() => {
                // Проверяем совпадения после завершения анимации
                this.checkMatches();
                
                // Разблокируем взаимодействие
                this.grid.flat().forEach(cell => {
                    if (cell.item && cell.item.input) {
                        cell.item.input.enabled = true;
                    }
                });
            });
        } else {
            console.log("❌ Ячейки не являются соседними");
            this.resetPosition(gameObject);
        }
    }

    findCellByItem(item) {
        return this.grid.flat().find(cell => cell.item === item);
    }

    swapItems(cell1, cell2) {
        if (!cell1 || !cell2 || !cell1.item || !cell2.item) return Promise.resolve();

        return new Promise((resolve) => {
            const x1 = cell1.tile.x;
            const y1 = cell1.tile.y;
            const x2 = cell2.tile.x;
            const y2 = cell2.tile.y;

            // Устанавливаем правильный порядок глубины
            cell1.item.setDepth(3);
            cell2.item.setDepth(3);

            // Анимируем перемещение обоих элементов
            this.tweens.add({
                targets: cell1.item,
                x: x2,
                y: y2,
                duration: 200,
                ease: 'Power2'
            });

            this.tweens.add({
                targets: cell2.item,
                x: x1,
                y: y1,
                duration: 200,
                ease: 'Power2',
                onComplete: () => {
                    // Меняем элементы местами в данных сетки
                    const tempItem = cell1.item;
                    const tempType = cell1.type;
                    
                    cell1.item = cell2.item;
                    cell1.type = cell2.type;
                    cell2.item = tempItem;
                    cell2.type = tempType;

                    // Возвращаем нормальную глубину
                    cell1.item.setDepth(2);
                    cell2.item.setDepth(2);

                    resolve();
                }
            });
        });
    }

    checkMatches() {
        const matches = new Set();
        
        // Проверяем горизонтальные совпадения
        for (let row = 0; row < this.gridSize; row++) {
            for (let col = 0; col < this.gridSize - 2; col++) {
                const cell1 = this.grid[row][col];
                const cell2 = this.grid[row][col + 1];
                const cell3 = this.grid[row][col + 2];
                
                if (cell1.type && cell1.type === cell2.type && cell2.type === cell3.type) {
                    matches.add(cell1);
                    matches.add(cell2);
                    matches.add(cell3);
                }
            }
        }
        
        // Проверяем вертикальные совпадения
        for (let row = 0; row < this.gridSize - 2; row++) {
            for (let col = 0; col < this.gridSize; col++) {
                const cell1 = this.grid[row][col];
                const cell2 = this.grid[row + 1][col];
                const cell3 = this.grid[row + 2][col];
                
                if (cell1.type && cell1.type === cell2.type && cell2.type === cell3.type) {
                    matches.add(cell1);
                    matches.add(cell2);
                    matches.add(cell3);
                }
            }
        }

        if (matches.size > 0) {
            this.removeMatches(matches);
            return true;
        }
        
        return false;
    }

    removeMatches(matches) {
        return new Promise(resolve => {
            let pendingDestroys = matches.size;
            
            matches.forEach(cell => {
                if (cell.item) {
                    // Добавляем подсчет уничтоженных items перед их уничтожением
                    this.updateItemCount(cell.type);
                    
                    this.tweens.add({
                        targets: cell.item,
                        alpha: 0,
                        scale: 0,
                        duration: 300,
                        onComplete: () => {
                            if (cell.item) {
                                cell.item.destroy();
                                cell.item = null;
                                cell.type = null;
                            }
                            pendingDestroys--;
                            if (pendingDestroys === 0) {
                                this.shiftTiles().then(resolve);
                            }
                        }
                    });
                } else {
                    pendingDestroys--;
                    if (pendingDestroys === 0) {
                        this.shiftTiles().then(resolve);
                    }
                }
            });
        });
    }

    shiftTiles() {
        return new Promise(resolve => {
            let moved = false;
            let pendingTweens = 0;

            // Сдвигаем существующие элементы вниз
            for (let col = 0; col < this.gridSize; col++) {
                let emptySpaces = 0;
                
                // Считаем пустые места снизу вверх
                for (let row = this.gridSize - 1; row >= 0; row--) {
                    if (!this.grid[row][col].item) {
                        emptySpaces++;
                    } else if (emptySpaces > 0) {
                        const currentCell = this.grid[row][col];
                        const targetCell = this.grid[row + emptySpaces][col];
                        
                        pendingTweens++;
                        this.tweens.add({
                            targets: currentCell.item,
                            y: targetCell.tile.y,
                            duration: 200,
                            ease: 'Bounce',
                            onComplete: () => {
                                pendingTweens--;
                                if (pendingTweens === 0) {
                                    this.createNewTiles().then(resolve);
                                }
                            }
                        });

                        targetCell.item = currentCell.item;
                        targetCell.type = currentCell.type;
                        currentCell.item = null;
                        currentCell.type = null;
                        moved = true;
                    }
                }
            }

            if (!moved) {
                this.createNewTiles().then(resolve);
            }
        });
    }

    createNewTiles() {
        return new Promise(resolve => {
            let newTilesTweens = 0;
            let pendingItems = [];

            // Сначала собираем все новые элементы, которые нужно создать
            for (let col = 0; col < this.gridSize; col++) {
                let emptyCount = 0;
                for (let row = 0; row < this.gridSize; row++) {
                    if (!this.grid[row][col].item) {
                        emptyCount++;
                        pendingItems.push({row, col, emptyCount});
                    }
                }
            }

            // Если нет элементов для создания, завершаем
            if (pendingItems.length === 0) {
                resolve();
                return;
            }

            // Создаем элементы последовательно
            pendingItems.forEach(({row, col, emptyCount}) => {
                const itemType = this.getRandomValidItem(row, col);
                const startY = this.grid[row][col].tile.y - (this.tileSize * (emptyCount + 1));
                
                const item = this.add.image(
                    this.grid[row][col].tile.x,
                    startY,
                    itemType
                )
                .setDisplaySize(37, 37)
                .setDepth(2)
                .setInteractive({ 
                    draggable: true,
                    useHandCursor: true,
                    pixelPerfect: true
                });

                newTilesTweens++;
                this.tweens.add({
                    targets: item,
                    y: this.grid[row][col].tile.y,
                    duration: 300,
                    ease: 'Bounce',
                    onComplete: () => {
                        item.input.enabled = true;
                        newTilesTweens--;
                        if (newTilesTweens === 0) {
                            this.time.delayedCall(100, () => {
                                this.checkMatches();
                                resolve();
                            });
                        }
                    }
                });

                this.grid[row][col].item = item;
                this.grid[row][col].type = itemType;
            });
        });
    }

    resetPosition(gameObject) {
        const cell = this.findCellByItem(gameObject);
        if (!cell) return;

        // Временно отключаем интерактивность
        if (gameObject.input) {
            gameObject.input.enabled = false;
        }

        // Очищаем выделение
        this.clearSelection();

        return new Promise((resolve) => {
            this.tweens.add({
                targets: gameObject,
                x: cell.tile.x,
                y: cell.tile.y,
                duration: 200,
                ease: 'Power2',
                onComplete: () => {
                    if (gameObject && gameObject.input) {
                        gameObject.input.enabled = true;
                        gameObject.setDepth(2);
                    }
                    resolve();
                }
            });
        });
    }

    selectItem(gameObject) {
        if (!gameObject || !gameObject.texture) return;

        // Очищаем предыдущее выделение перед созданием нового
        this.clearSelection();

        console.log("🎯 Выбран элемент:", gameObject.texture.key);
        
        // Создаем новый бордер
        let border = this.add.graphics().setDepth(3);
        border.lineStyle(3, 0xFFD700, 1);
        border.strokeRoundedRect(gameObject.x - 20, gameObject.y - 20, 40, 40, 8);

        // Сохраняем выбранный элемент и его бордер
        this.selectedItem = { item: gameObject, border };
    }

    showMusicPopup() {
        let popupContainer = this.add.container(0, 0).setDepth(999);

        let popupBg = this.add.graphics();
        popupBg.fillStyle(0xFFF7C6, 1);
        popupBg.fillRoundedRect(50, 300, 340, 200, 20);
        popupContainer.add(popupBg);

        let popupText = this.add.text(220, 350, "Музыка", {
            fontSize: "24px",
            fill: "#A04F32",
            fontFamily: "Montserrat",
            fontWeight: "600",
            align: "center"
        }).setOrigin(0.5);
        popupContainer.add(popupText);

        // Кнопка включения музыки (ON)
        let musicOnButton = this.add.text(150, 400, "ON", {
            fontSize: "20px",
            fill: "#A04F32",
            fontFamily: "Montserrat",
            fontWeight: "600",
            backgroundColor: "#FFD4A3",
            padding: { x: 10, y: 5 }
        }).setOrigin(0.5).setInteractive({ useHandCursor: true });

        musicOnButton.on("pointerdown", () => {
            console.log("Music ON clicked!");
            this.toggleMusic(true);
        });

        popupContainer.add(musicOnButton);

        // Кнопка выключения музыки (OFF)
        let musicOffButton = this.add.text(290, 400, "OFF", {
            fontSize: "20px",
            fill: "#A04F32",
            fontFamily: "Montserrat",
            fontWeight: "600",
            backgroundColor: "#FFD4A3",
            padding: { x: 10, y: 5 }
        }).setOrigin(0.5).setInteractive({ useHandCursor: true });

        musicOffButton.on("pointerdown", () => {
            console.log("Music OFF clicked!");
            this.toggleMusic(false);
        });

        popupContainer.add(musicOffButton);

        // Кнопка закрытия
        let closeButton = this.add.text(220, 320, "✖", {
            fontSize: "28px",
            fill: "#A04F32",
            fontFamily: "Montserrat",
            fontWeight: "bold"
        }).setOrigin(0.5).setInteractive({ useHandCursor: true });

        closeButton.on("pointerdown", () => {
            popupContainer.destroy();
        });

        popupContainer.add(closeButton);
    }

    toggleMusic(enable) {
        if (enable) {
            if (!this.music.isPlaying) this.music.play();
        } else {
            if (this.music.isPlaying) this.music.stop();
        }
    }

    updateTimer() {
        this.timeLeft--;
        if (this.timeLeft <= 0) {
            this.timer.remove();
            // Действия по окончании времени
        }
    }

    initAudio() {
        if (!this.audioInitialized) {
            this.sound.unlock();
            this.audioInitialized = true;
        }
    }

    clearSelection() {
        if (this.selectedItem && this.selectedItem.border) {
            this.selectedItem.border.destroy();
        }
        this.selectedItem = null;
    }

    getRandomValidItem(row, col) {
        let availableItems = [...this.items];
        
        // Проверяем горизонтальные совпадения
        if (col >= 2) {
            const item1 = this.grid[row][col - 2].type;
            const item2 = this.grid[row][col - 1].type;
            if (item1 === item2) {
                availableItems = availableItems.filter(item => item !== item1);
            }
        }
        
        // Проверяем вертикальные совпадения
        if (row >= 2) {
            const item1 = this.grid[row - 2][col].type;
            const item2 = this.grid[row - 1][col].type;
            if (item1 === item2) {
                availableItems = availableItems.filter(item => item !== item1);
            }
        }
        
        // Если все элементы были отфильтрованы, возвращаем случайный из исходного списка
        if (availableItems.length === 0) {
            availableItems = [...this.items];
        }
        
        return Phaser.Math.RND.pick(availableItems);
    }

    // Добавляем метод для обновления счетчиков
    updateItemCount(itemType) {
        this.itemCounts[itemType]++;
        const countText = this.children.getByName(`${itemType}_count`);
        if (countText) {
            countText.setText(this.itemCounts[itemType].toString());
        }
    }

    showBombSelectionPopup() {
        console.log("Entering showBombSelectionPopup");
        console.log("Bomb count:", this.bombCount);
        
        if (this.bombCount <= 0) {
            console.log("No bombs left!");
            return;
        }
        
        console.log("Creating bomb selection UI");
        
        // Создаем только затемнение без текста
        const overlay = this.add.rectangle(
            this.cameras.main.centerX,
            this.cameras.main.centerY,
            this.cameras.main.width,
            this.cameras.main.height,
            0x000000,
            0.5
        );
        
        // Группируем элементы интерфейса (теперь только оверлей)
        this.bombUI = this.add.group([overlay]);
        
        // Включаем режим выбора ячейки
        this.bombMode = true;
        console.log("Bomb mode activated:", this.bombMode);
        
        // Добавляем обработчик клика по ячейкам
        const clickHandler = (pointer) => {
            console.log("Click detected in bomb mode:", this.bombMode);
            if (!this.bombMode) return;
            
            // Находим ближайшую ячейку к месту клика
            const cell = this.findNearestCell(pointer.x, pointer.y);
            console.log("Nearest cell:", cell);
            
            if (cell && cell.item) {
                console.log("Valid cell found for explosion:", cell.row, cell.col);
                this.explodeCells(cell);
                this.bombCount--;
                this.bombCountText.setText(this.bombCount.toString());
                this.bombUI.destroy(true);
                this.bombMode = false;
                this.input.off('pointerdown', clickHandler);
            }
        };
        
        // Добавляем обработчик клика
        this.input.on('pointerdown', clickHandler);
        
        // Добавляем возможность отмены по ESC
        const escHandler = (event) => {
            if (event.code === 'Escape') {
                console.log("ESC pressed, cancelling bomb mode");
                this.bombUI.destroy(true);
                this.bombMode = false;
                this.input.off('pointerdown', clickHandler);
                this.input.keyboard.off('keydown', escHandler);
            }
        };
        
        this.input.keyboard.on('keydown', escHandler);
    }

    explodeCells(centerCell) {
        console.log("Exploding cells at:", centerCell.row, centerCell.col);
        
        const cellsToExplode = [];
        for (let row = -1; row <= 1; row++) {
            for (let col = -1; col <= 1; col++) {
                const newRow = centerCell.row + row;
                const newCol = centerCell.col + col;
                
                if (newRow >= 0 && newRow < this.gridSize &&
                    newCol >= 0 && newCol < this.gridSize) {
                    const cell = this.grid[newRow][newCol];
                    if (cell && cell.item) {
                        cellsToExplode.push(cell);
                    }
                }
            }
        }
        
        cellsToExplode.forEach(cell => {
            if (cell.item) {
                // Создаем эмиттер частиц с высоким z-index
                const emitter = this.add.particles(cell.item.x, cell.item.y, 'particle', {
                    speed: { min: 100, max: 200 },
                    angle: { min: 0, max: 360 },
                    scale: { start: 1, end: 0 },
                    lifespan: 800,
                    blendMode: 'ADD',
                    quantity: 20,
                    rotate: { min: 0, max: 360 },
                    tint: [0xffff00, 0xff0000, 0xff6600],
                    alpha: { start: 1, end: 0 }
                }).setDepth(9999); // Устанавливаем максимальный z-index
                
                // Анимируем исчезновение ячейки, тоже с высоким z-index
                cell.item.setDepth(9998); // Чуть ниже частиц, но выше остальных элементов
                this.tweens.add({
                    targets: cell.item,
                    scale: 1.5,
                    alpha: 0,
                    duration: 300,
                    onComplete: () => {
                        cell.item.destroy();
                        cell.item = null;
                        cell.type = null;
                        // Останавливаем эмиттер через некоторое время
                        this.time.delayedCall(400, () => {
                            emitter.destroy();
                        });
                    }
                });
            }
        });
        
        // Запускаем заполнение пустых ячеек после небольшой задержки
        this.time.delayedCall(500, () => {
            this.shiftTiles().then(() => {
                this.createNewTiles();
            });
        });
    }

    showGearSelectionMode() {
        // Очищаем выделение перед активацией режима
        this.clearSelection();
        
        // Проверяем, не активен ли уже какой-то режим
        if (this.gearMode || this.bombMode || this.gearCount <= 0) return;

        // Удаляем предыдущий UI если он существует
        if (this.gearUI) {
            this.gearUI.destroy(true);
        }

        // Создаем затемнение
        const overlay = this.add.rectangle(
            this.cameras.main.centerX,
            this.cameras.main.centerY,
            this.cameras.main.width,
            this.cameras.main.height,
            0x000000,
            0.5
        );
        
        // Группируем элементы интерфейса
        this.gearUI = this.add.group([overlay]);
        
        // Включаем режим выбора ячейки
        this.gearMode = true;
        
        // Подсвечиваем все ячейки белым цветом
        this.grid.forEach(row => {
            row.forEach(cell => {
                if (cell.item) {
                    cell.item.setTint(0xffffff);
                }
            });
        });
        
        // Создаем обработчик клика
        const clickHandler = (pointer, gameObject) => {
            if (!this.gearMode || !gameObject.texture || !this.items.includes(gameObject.texture.key)) return;

            const selectedType = gameObject.texture.key;
            this.cleanupGearMode(); // Очищаем режим перед уничтожением элементов
            this.destroyAllItemsOfType(selectedType);
            this.gearCount--;
            this.gearCountText.setText(this.gearCount.toString());
        };

        // Добавляем обработчик клика
        this.input.on('gameobjectdown', clickHandler);

        // Добавляем возможность отмены по ESC
        const escHandler = (event) => {
            if (event.code === 'Escape') {
                this.cleanupGearMode();
            }
        };

        this.input.keyboard.on('keydown', escHandler);

        // Сохраняем ссылки на обработчики для последующей очистки
        this._currentGearClickHandler = clickHandler;
        this._currentGearEscHandler = escHandler;
    }

    // Новый метод для очистки режима шестеренки
    cleanupGearMode() {
        if (!this.gearMode) return;

        // Очищаем выделение при выходе из режима
        this.clearSelection();

        if (this.gearUI) {
            this.gearUI.destroy(true);
        }
        
        // Убираем подсветку со всех ячеек
        this.grid.forEach(row => {
            row.forEach(cell => {
                if (cell.item) {
                    cell.item.clearTint();
                }
            });
        });

        // Удаляем обработчики событий
        if (this._currentGearClickHandler) {
            this.input.off('gameobjectdown', this._currentGearClickHandler);
            this._currentGearClickHandler = null;
        }
        
        if (this._currentGearEscHandler) {
            this.input.keyboard.off('keydown', this._currentGearEscHandler);
            this._currentGearEscHandler = null;
        }

        this.gearMode = false;
    }

    destroyAllItemsOfType(itemType) {
        const itemsToDestroy = this.grid.flat().filter(cell => cell.type === itemType);
        
        itemsToDestroy.forEach(cell => {
            if (cell.item) {
                // Создаем эффект для каждого уничтожаемого элемента
                const emitter = this.add.particles(cell.item.x, cell.item.y, 'particle', {
                    speed: { min: 100, max: 200 },
                    angle: { min: 0, max: 360 },
                    scale: { start: 1, end: 0 },
                    lifespan: 800,
                    blendMode: 'ADD',
                    quantity: 20,
                    rotate: { min: 0, max: 360 },
                    tint: [0x00ff00, 0x00ffff, 0x0000ff],
                    alpha: { start: 1, end: 0 }
                }).setDepth(9999);

                cell.item.setDepth(9998);
                this.tweens.add({
                    targets: cell.item,
                    scale: 1.5,
                    alpha: 0,
                    duration: 300,
                    onComplete: () => {
                        cell.item.destroy();
                        cell.item = null;
                        cell.type = null;
                        this.time.delayedCall(400, () => {
                            emitter.destroy();
                        });
                    }
                });
            }
        });

        // Запускаем заполнение пустых ячеек после небольшой задержки
        this.time.delayedCall(500, () => {
            this.shiftTiles().then(() => {
                this.createNewTiles();
            });
        });
    }
}

