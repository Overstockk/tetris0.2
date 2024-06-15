document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('gameCanvas');
    const ctx = canvas.getContext('2d');
    const scoreElement = document.getElementById('score');
    const highScoreElement = document.getElementById('highScore');
    const linesElement = document.getElementById('lines');
    const speedElement = document.getElementById('speed');
    const pauseButton = document.getElementById('pauseButton');
    const restartButton = document.getElementById('restartButton');

    const COLS = 10;
    const ROWS = 20;
    const BLOCK_SIZE = 30;

    let board = Array.from({ length: ROWS }, () => Array(COLS).fill(0));
    let score = 0;
    let highScore = localStorage.getItem('tetrisHighScore') || 0;
    let lines = 0; // Додаємо змінну для підрахунку ліній
    let gameOver = false;
    let paused = false;
    let currentPiece;
    let animationId;
    let lastTime = 0;
    let initialSpeed = 1; // Початкова швидкість, яка відображається
    let dropInterval = 200; // Початковий інтервал для падіння фігур (мс) - еквівалентний швидкості 5
    let dropCounter = 0;
    let speed = initialSpeed; // Початкова швидкість, яка відображається
    let fpsInterval = 1000 / 60; // 60 FPS
    let lastDrawTime = 0;

    // Оновити елемент рекорду
    highScoreElement.textContent = highScore;
    linesElement.textContent = lines; // Оновити елемент для кількості ліній
    speedElement.textContent = initialSpeed; // Оновлення елементу швидкості

    const COLORS = [
        '#00f0f0', // I
        '#0000f0', // J
        '#f0a000', // L
        '#f0f000', // O
        '#00f000', // S
        '#a000f0', // T
        '#f00000'  // Z
    ];

    const SHAPES = [
        [[1, 1, 1, 1]], // I
        [[1, 0, 0], [1, 1, 1]], // J
        [[0, 0, 1], [1, 1, 1]], // L
        [[1, 1], [1, 1]], // O
        [[0, 1, 1], [1, 1, 0]], // S
        [[0, 1, 0], [1, 1, 1]], // T
        [[1, 1, 0], [0, 1, 1]]  // Z
    ];

    class Piece {
        constructor(shape, color) {
            this.shape = shape;
            this.color = color;
            this.x = Math.floor(COLS / 2) - Math.floor(this.shape[0].length / 2);
            this.y = 0;
        }

        draw() {
            ctx.fillStyle = this.color;
            for (let row = 0; row < this.shape.length; row++) {
                for (let col = 0; col < this.shape[row].length; col++) {
                    if (this.shape[row][col]) {
                        ctx.fillRect((this.x + col) * BLOCK_SIZE, (this.y + row) * BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE);
                        ctx.strokeStyle = '#111';
                        ctx.strokeRect((this.x + col) * BLOCK_SIZE, (this.y + row) * BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE);
                    }
                }
            }
        }

        move(deltaX, deltaY) {
            this.x += deltaX;
            this.y += deltaY;
            if (this.hasCollision()) {
                this.x -= deltaX;
                this.y -= deltaY;
                return false;
            }
            return true;
        }

        rotate() {
            const shape = this.shape;
            const newShape = shape[0].map((_, i) => shape.map(row => row[i]).reverse());
            const oldX = this.x;
            const oldY = this.y;

            this.shape = newShape;
            if (this.hasCollision()) {
                this.shape = shape;
                this.x = oldX;
                this.y = oldY;
            }
        }

        hasCollision() {
            for (let row = 0; row < this.shape.length; row++) {
                for (let col = 0; col < this.shape[row].length; col++) {
                    if (this.shape[row][col]) {
                        const newX = this.x + col;
                        const newY = this.y + row;
                        if (newX < 0 || newX >= COLS || newY >= ROWS || board[newY] && board[newY][newX]) {
                            return true;
                        }
                    }
                }
            }
            return false;
        }

        lock() {
            for (let row = 0; row < this.shape.length; row++) {
                for (let col = 0; col < this.shape[row].length; col++) {
                    if (this.shape[row][col]) {
                        board[this.y + row][this.x + col] = this.color;
                    }
                }
            }
            this.animateClearLines();
        }

        // Функція для анімації розпаду ліній перед видаленням
        animateClearLines() {
            let linesToClear = [];
            for (let row = 0; row < ROWS; row++) {
                if (board[row].every(cell => cell !== 0)) {
                    linesToClear.push(row);
                }
            }

            if (linesToClear.length > 0) {
                let step = 0;
                const intervalId = setInterval(() => {
                    linesToClear.forEach(row => {
                        for (let col = 0; col < COLS; col++) {
                            board[row][col] = (step % 2 === 0) ? '#ff5555' : '#ffaaaa'; // Ефект розпаду
                        }
                    });
                    drawBoard(); // Оновлюємо екран з ефектом
                    step++;
                    if (step > 2) { // Після кількох кроків анімації видаляємо лінії
                        clearInterval(intervalId);
                        setTimeout(() => { // Затримка для плавного падіння блоків
                            linesToClear.forEach(row => {
                                board.splice(row, 1); // Видаляємо рядки з дошки
                                board.unshift(Array(COLS).fill(0)); // Додаємо порожні рядки на верх дошки
                            });
                            score += linesToClear.length * 10; // Додаємо очки за очищені лінії
                            lines += linesToClear.length; // Оновлюємо кількість ліній
                            scoreElement.textContent = score; // Оновлюємо відображення рахунку
                            linesElement.textContent = lines; // Оновлюємо відображення кількості ліній
                            updateSpeed(); // Оновлюємо швидкість гри
                            drawBoard(); // Оновлюємо екран з новими рядками
                        }, 100); // Затримка в 100 мс для плавного падіння блоків
                    }
                }, 50); // Швидкий інтервал для анімації розпаду
            }
        }
    }

    function getRandomPiece() {
        const index = Math.floor(Math.random() * SHAPES.length);
        return new Piece(SHAPES[index], COLORS[index]);
    }

    function drawGrid() {
        ctx.strokeStyle = '#1f1f1f';
        for (let x = 0; x <= COLS * BLOCK_SIZE; x += BLOCK_SIZE) {
            ctx.moveTo(x, 0);
            ctx.lineTo(x, ROWS * BLOCK_SIZE);
        }
        for (let y = 0; y <= ROWS * BLOCK_SIZE; y += BLOCK_SIZE) {
            ctx.moveTo(0, y);
            ctx.lineTo(COLS * BLOCK_SIZE, y);
        }
        ctx.stroke();
    }

    function drawBoard() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        for (let row = 0; row < ROWS; row++) {
            for (let col = 0; col < COLS; col++) {
                if (board[row][col]) {
                    ctx.fillStyle = board[row][col] === 'clearing' ? '#ffffff' : board[row][col]; // Показуємо лінії, що видаляються
                    ctx.fillRect(col * BLOCK_SIZE, row * BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE);
                    ctx.strokeStyle = '#111';
                    ctx.strokeRect(col * BLOCK_SIZE, row * BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE);
                }
            }
        }
        drawGrid();
    }

    function update(time = 0) {
        const deltaTime = time - lastTime;
        lastTime = time;

        if (!paused) {
            dropCounter += deltaTime;

            if (dropCounter > dropInterval) {
                if (!currentPiece.move(0, 1)) {
                    currentPiece.lock();
                    if (currentPiece.y === 0) {
                        gameOver = true;
                        checkHighScore();
                    } else {
                        currentPiece = getRandomPiece();
                    }
                }
                dropCounter = 0;
            }

            if (time - lastDrawTime >= fpsInterval) {
                drawBoard();
                currentPiece.draw();
                lastDrawTime = time;
            }

            if (!gameOver) {
                animationId = requestAnimationFrame(update);
            } else {
                alert('Гра завершена');
            }
        }
    }

    function checkHighScore() {
        if (score > highScore) {
            highScore = score;
            highScoreElement.textContent = highScore;
            localStorage.setItem('tetrisHighScore', highScore);
        }
    }

    function updateSpeed() {
        speed = Math.floor(lines / 10) + initialSpeed; // Початкова швидкість 1, збільшується кожні 10 ліній
        dropInterval = Math.max(1000 / (speed + 4), 50); // Інтервал падіння фігур зменшується з ростом швидкості, мінімум 50мс
        speedElement.textContent = speed; // Оновлення відображення швидкості
    }

    document.addEventListener('keydown', event => {
        if (paused) return; // Ігнорувати клавіші, якщо гра на паузі
        if (event.key === 'ArrowLeft') {
            currentPiece.move(-1, 0);
        } else if (event.key === 'ArrowRight') {
            currentPiece.move(1, 0);
        } else if (event.key === 'ArrowDown') {
            if (currentPiece.move(0, 1)) {
                dropCounter = 0; // Оновлюємо лічильник падіння при швидкому русі вниз
            }
        } else if (event.key === 'ArrowUp') {
            currentPiece.rotate();
        }
        drawBoard();
        currentPiece.draw();
    });

    pauseButton.addEventListener('click', () => {
        if (paused) {
            paused = false;
            pauseButton.textContent = 'Пауза';
            update();
        } else {
            paused = true;
            pauseButton.textContent = 'Відновити';
            cancelAnimationFrame(animationId);
        }
    });

    restartButton.addEventListener('click', () => {
        cancelAnimationFrame(animationId); // Зупинити поточний анімаційний кадр
        board = Array.from({ length: ROWS }, () => Array(COLS).fill(0));
        score = 0;
        lines = 0; // Скинути кількість ліній
        gameOver = false;
        paused = false;
        dropCounter = 0;
        speed = initialSpeed; // Початкова швидкість
        dropInterval = 200; // Початковий інтервал
        currentPiece = getRandomPiece();
        scoreElement.textContent = score;
        linesElement.textContent = lines; // Оновити відображення кількості ліній
        speedElement.textContent = speed;
        pauseButton.textContent = 'Пауза';
        drawBoard();
        update();
    });

    currentPiece = getRandomPiece();
    drawBoard();
    update();
});
