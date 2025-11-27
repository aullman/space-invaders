import * as PIXI from 'pixi.js';

// Types
type Enemy = PIXI.Graphics & {
    direction: number;
};

type IBullet = PIXI.Graphics & {
    angle?: number;
    dx?: number;
    dy?: number;
    bounceCount?: number;
};

// Game constants
const PLAYER_SPEED = 5;
const BULLET_SPEED = 7;
const POWER_UP_DURATION = 10000; // 10 seconds
const POWER_UP_SPAWN_INTERVAL = 20000; // 20 seconds
const BASE_ENEMY_SPEED = 0.5;
const ENEMY_SPEED_INCREASE = 0.2;
const ENEMY_ROWS = 3;
const ENEMIES_PER_ROW = 8;
const STARTING_LIVES = 3;

// Power-up types
enum PowerUpType {
    LASER = 'laser',
    RAPID_FIRE = 'rapid_fire',
    TRIPLE_SHOT = 'triple_shot'
}

// Power-up interface
type IPowerUp = PIXI.Graphics & {
    powerUpType: PowerUpType;
    powerUpActive: boolean;
    powerUpTimer: number;
    bulletAngle?: number; // For triple shot
};

// Game state
let currentLevel = 1;
let bullets: IBullet[] = [];
let lives = STARTING_LIVES;
let gameOver = false;
let enemySpeed = BASE_ENEMY_SPEED;
let enemies: Enemy[] = [];
let enemyBombs: PIXI.Graphics[] = [];
let powerUps: IPowerUp[] = [];
let explosions: PIXI.Graphics[] = [];
let left = false;
let right = false;
let space = false;
let canShoot = true;
let shootTimer = 0;
let bombDropTimer = 0;
let lastPowerUpTime = 0;
let activePowerUp: IPowerUp | null = null;
const BULLET_COOLDOWN = 500; // ms between shots (reduced for rapid fire)
const LASER_WIDTH = 6;
const BOMB_DROP_INTERVAL = 60; // frames between bomb drops
const BOMB_SPEED = 3;

// Sound effects - use base URL for GitHub Pages compatibility
const baseUrl = import.meta.env.BASE_URL;
const explosionSound = new Audio(`${baseUrl}sounds/explosion.mp3`);
const shootSound = new Audio(`${baseUrl}sounds/shoot.mp3`);
const powerUpSound = new Audio(`${baseUrl}sounds/powerup.wav`);
shootSound.volume = 0.3; // Reduce volume a bit
powerUpSound.volume = 0.5;

// Create explosion effect
function createExplosion(x: number, y: number, volume: number = 0.3) {
    const explosion = new PIXI.Graphics();
    explosion.beginFill(0xff0000);
    explosion.drawCircle(0, 0, 5);
    explosion.endFill();
    explosion.x = x;
    explosion.y = y;
    explosion.alpha = 1;
    explosion.scale.set(0.5);
    
    // Play explosion sound if volume is greater than 0
    if (volume > 0) {
        const sound = explosionSound.cloneNode() as HTMLAudioElement;
        sound.volume = volume;
        sound.play().catch(e => console.log("Audio play failed:", e));
    }
    
    app.stage.addChild(explosion);
    explosions.push(explosion);
    
    // Animate explosion
    let frame = 0;
    const maxFrames = 20;
    const animate = () => {
        if (frame >= maxFrames) {
            app.stage.removeChild(explosion);
            const index = explosions.indexOf(explosion);
            if (index > -1) {
                explosions.splice(index, 1);
            }
            return;
        }
        
        const progress = frame / maxFrames;
        explosion.scale.set(0.5 + progress * 3);
        explosion.alpha = 1 - progress;
        
        // Change color from red to orange to yellow
        if (progress < 0.33) {
            explosion.tint = 0xff0000; // Red
        } else if (progress < 0.66) {
            explosion.tint = 0xff8800; // Orange
        } else {
            explosion.tint = 0xffff00; // Yellow
        }
        
        frame++;
        requestAnimationFrame(animate);
    };
    
    animate();
}

// Create PixiJS application
const app = new PIXI.Application({
    width: 800,
    height: 600,
    backgroundColor: 0x000000,
    antialias: true,
});

// Add the canvas to the DOM
document.body.appendChild(app.view as unknown as HTMLElement);

// Create UI text
const style = new PIXI.TextStyle({
    fill: '#ffffff',
    fontSize: 20,
    fontFamily: 'Arial',
});

// Power-up display
const powerUpDisplay = new PIXI.Text('', new PIXI.TextStyle({
    fill: '#00ff00',
    fontSize: 16,
    fontFamily: 'Arial',
}));
powerUpDisplay.x = 20;
powerUpDisplay.y = 80;
app.stage.addChild(powerUpDisplay);

const levelText = new PIXI.Text(`Level: ${currentLevel}`, style);
levelText.x = 20;
levelText.y = 20;

const livesText = new PIXI.Text(`Lives: ${lives}`, style);
livesText.x = 20;
livesText.y = 50;

const gameOverText = new PIXI.Text('GAME OVER\nPress R to restart', new PIXI.TextStyle({
    ...style,
    fontSize: 36,
    align: 'center',
}));
gameOverText.anchor.set(0.5);
gameOverText.x = app.screen.width / 2;
gameOverText.y = app.screen.height / 2;
gameOverText.visible = false;

// Create player ship (gun turret)
const player = new PIXI.Graphics();
const playerColor = 0x00ff00;
const playerWidth = 40;
const playerHeight = 25;
const cannonWidth = 6;
const cannonHeight = 12;

// Main body (saucer shape)
player.beginFill(playerColor);
player.moveTo(0, playerHeight);
player.lineTo(5, 5);
player.lineTo(playerWidth - 5, 5);
player.lineTo(playerWidth, playerHeight);
player.lineTo(0, playerHeight);
player.endFill();

// Cockpit
player.beginFill(0x00aaff);
player.drawEllipse(playerWidth / 2, 10, 10, 4);
player.endFill();

// Cannon (top center)
player.beginFill(0x333333);
player.drawRect(
    (playerWidth / 2) - (cannonWidth / 2),
    -cannonHeight,
    cannonWidth,
    cannonHeight
);
player.endFill();

// Wing details
player.lineStyle(2, 0x00cc00);
player.moveTo(8, playerHeight - 5);
player.lineTo(15, 15);
player.moveTo(playerWidth - 8, playerHeight - 5);
player.lineTo(playerWidth - 15, 15);

// Set initial position
player.x = app.screen.width / 2 - (playerWidth / 2);
player.y = app.screen.height - playerHeight - 20;

app.stage.addChild(player);

function createEnemies() {
    // Clear existing enemies
    enemies.forEach(enemy => app.stage.removeChild(enemy));
    enemies = [];
    
    // Create new enemies
    const enemyColors = [0x00ff00, 0x00ffff, 0xff00ff]; // Different colors for each row
    
    for (let row = 0; row < ENEMY_ROWS; row++) {
        for (let col = 0; col < ENEMIES_PER_ROW; col++) {
            const enemy = new PIXI.Graphics() as Enemy;
            const color = enemyColors[row % enemyColors.length];
            
            // Draw the classic Space Invaders enemy shape
            enemy.beginFill(color);
            // Top part (head)
            enemy.drawRect(5, 0, 20, 5);
            // Middle part (body)
            enemy.drawRect(0, 5, 30, 10);
            // Bottom part (legs)
            enemy.drawRect(5, 15, 20, 5);
            // Eyes
            enemy.beginFill(0x000000);
            enemy.drawRect(10, 8, 4, 4);
            enemy.drawRect(16, 8, 4, 4);
            enemy.endFill();
            
            // Add some details
            enemy.beginFill(color);
            // Side arms
            enemy.drawRect(0, 8, 5, 4);
            enemy.drawRect(25, 8, 5, 4);
            // Bottom details
            enemy.drawRect(10, 20, 10, 2);
            enemy.endFill();
            
            // Position the enemy
            enemy.x = col * 60 + 100;
            enemy.y = row * 40 + 50;
            enemy.direction = 1;
            
            // Add some animation by making them pulse slightly
            const startScale = 0.8 + (row * 0.1);
            enemy.scale.set(startScale);
            
            enemies.push(enemy);
            app.stage.addChild(enemy);
        }
    }
}

// Initialize enemies
createEnemies();

// Add UI elements to stage
app.stage.addChild(levelText, livesText, gameOverText);

// Game state management
function updateUI() {
    levelText.text = `Level: ${currentLevel}`;
    livesText.text = `Lives: ${lives}`;
}

function dropBomb(x: number, y: number) {
    const bomb = new PIXI.Graphics();
    bomb.beginFill(0xff00ff);
    bomb.drawCircle(0, 0, 3);
    bomb.endFill();
    bomb.x = x;
    bomb.y = y;
    enemyBombs.push(bomb);
    app.stage.addChild(bomb);
}

function resetGame(isNewGame: boolean = false) {
    // Reset game state
    gameOver = false;
    
    // Only reset lives and level if it's a new game
    if (isNewGame) {
        lives = STARTING_LIVES;
        currentLevel = 1;
        enemySpeed = BASE_ENEMY_SPEED;
    }
    
    bombDropTimer = 0;
    
    // Clear bullets and bombs
    bullets.forEach(bullet => app.stage.removeChild(bullet));
    bullets = [];
    enemyBombs.forEach(bomb => app.stage.removeChild(bomb));
    enemyBombs = [];
    
    // Reset player position
    player.x = app.screen.width / 2;
    player.visible = true;
    
    // Update UI
    updateUI();
    gameOverText.visible = false;
    
    // Create new enemies
    createEnemies();
}

function nextLevel() {
    currentLevel++;
    enemySpeed = BASE_ENEMY_SPEED + (currentLevel - 1) * ENEMY_SPEED_INCREASE;
    updateUI();
    createEnemies();
}

// Initialize game
resetGame(true);

// Key press handlers
window.addEventListener('keydown', (e: KeyboardEvent) => {
    if (gameOver && e.key.toLowerCase() === 'r') {
        resetGame(true);
        return;
    }
    
    if (gameOver) return;
    
    if (e.key === 'ArrowLeft') left = true;
    if (e.key === 'ArrowRight') right = true;
    if (e.key === ' ') space = true;
});

window.addEventListener('keyup', (e: KeyboardEvent) => {
    if (e.key === 'ArrowLeft') left = false;
    if (e.key === 'ArrowRight') right = false;
    if (e.key === ' ') {
        space = false;
        canShoot = true;
    }
});

// Remove duplicate interface

function createPowerUp(type: PowerUpType): IPowerUp | null {
    const powerUp = new PIXI.Graphics() as unknown as IPowerUp;
    powerUp.powerUpType = type;
    powerUp.powerUpActive = false;
    powerUp.powerUpTimer = 0;
    powerUp.bulletAngle = 0;
    
    // Draw different power-ups based on powerUpType
    switch(powerUp.powerUpType) {
        case PowerUpType.LASER:
            powerUp.beginFill(0x00ffff);
            powerUp.drawRect(-3, -15, 6, 30);
            powerUp.endFill();
            break;
        case PowerUpType.RAPID_FIRE:
            powerUp.beginFill(0xff69b4);
            powerUp.drawCircle(0, 0, 10);
            powerUp.endFill();
            break;
        case PowerUpType.TRIPLE_SHOT:
            powerUp.beginFill(0xffff00);
            for (let i = 0; i < 3; i++) {
                powerUp.drawRect(-10 + i * 10, -5, 5, 10);
            }
            powerUp.endFill();
            break;
    }
    
    // Position at top of screen
    powerUp.x = Math.random() * (app.screen.width - 30) + 15;
    powerUp.y = -20;
    powerUp.alpha = 0.8;
    
    app.stage.addChild(powerUp);
    return powerUp;
}

function activatePowerUp(powerUp: IPowerUp) {
    console.log('Activating power-up:', powerUp.powerUpType);
    
    // Deactivate current power-up if any
    if (activePowerUp) {
        console.log('Deactivating previous power-up:', activePowerUp.powerUpType);
        activePowerUp.powerUpActive = false;
    }
    
    activePowerUp = powerUp;
    powerUp.powerUpActive = true;
    powerUp.powerUpTimer = POWER_UP_DURATION;
    
    // Log active power-up
    console.log('New active power-up:', powerUp.powerUpType);
    
    // Play power-up sound
    const sound = powerUpSound.cloneNode() as HTMLAudioElement;
    sound.play().catch((e) => console.log("Power-up sound failed:", e));
    
    // Remove from power-ups array
    const powerUpIndex = powerUps.indexOf(powerUp);
    if (powerUpIndex > -1) {
        powerUps.splice(powerUpIndex, 1);
    }
    
    // Remove from stage (active power-ups are not displayed)
    app.stage.removeChild(powerUp);
}

// Power-up state tracking
let powerUpSpawnTime = 0;

function updatePowerUps() {
    const now = Date.now();
    
    // Update power-up display
    if (activePowerUp) {
        const timeLeft = Math.ceil(activePowerUp.powerUpTimer / 1000);
        powerUpDisplay.text = `Power-up: ${activePowerUp.powerUpType} (${timeLeft}s)`;
    } else {
        powerUpDisplay.text = '';
        
        // Spawn new power-up if enough time has passed and no active power-up
        if (powerUps.length === 0 && now - powerUpSpawnTime > POWER_UP_SPAWN_INTERVAL) {
            console.log('Attempting to spawn power-up...');
            const powerUpTypes = [PowerUpType.LASER, PowerUpType.RAPID_FIRE, PowerUpType.TRIPLE_SHOT];
            const randomType = powerUpTypes[Math.floor(Math.random() * powerUpTypes.length)];
            console.log('Creating power-up of type:', randomType);
            
            const powerUp = createPowerUp(randomType);
            if (powerUp) {
                console.log('Power-up created successfully');
                powerUps.push(powerUp);
                powerUpSpawnTime = now;
            } else {
                console.error('Failed to create power-up');
            }
        }
    }
    
    // Update active power-up
    if (activePowerUp) {
        activePowerUp.powerUpTimer -= 16.67; // Fixed delta for 60fps
        if (activePowerUp.powerUpTimer <= 0) {
            console.log('Power-up expired:', activePowerUp.powerUpType);
            activePowerUp = null;
        }
    }
    
    // Move and check power-ups
    for (let i = powerUps.length - 1; i >= 0; i--) {
        const powerUp = powerUps[i];
        powerUp.y += 1; // Move down slowly
        
        // Remove if off screen
        if (powerUp.y > app.screen.height) {
            app.stage.removeChild(powerUp);
            powerUps.splice(i, 1);
            continue;
        }
        
        // Check collision with player
        if (checkCollision(powerUp, player)) {
            activatePowerUp(powerUp);
        }
    }
}

function shoot() {
    if (!canShoot) return;
    
    const now = Date.now();
    
    // Rapid fire allows shooting while space is held
    if (activePowerUp?.powerUpType === PowerUpType.RAPID_FIRE) {
        if (now - shootTimer < BULLET_COOLDOWN / 5) return; // Much faster shooting for rapid fire
    } else {
        if (!space) return; // Normal shooting requires space press
    }
    
    shootTimer = now;
    
    if (activePowerUp?.powerUpType === PowerUpType.LASER) {
        // Create a more visible laser beam
        const laser = new PIXI.Graphics();
        const startY = 0; // Start from top of screen
        const endY = player.y; // End at player's position
        
        // Position at player's x-coordinate
        laser.x = player.x + playerWidth / 2;
        laser.y = 0; // Position at top of screen
        
        // Draw from top to player
        laser.beginFill(0x00ffff, 1);
        laser.drawRect(-LASER_WIDTH/2, startY, LASER_WIDTH, endY);
        
        // Add outer glow
        laser.lineStyle(4, 0x00ffff, 0.5);
        laser.drawRect(-LASER_WIDTH/2 - 2, startY, LASER_WIDTH + 4, endY);
        laser.endFill();
        
        // Add a subtle pulsing effect
        const pulse = () => {
            laser.alpha = 0.8 + Math.sin(Date.now() * 0.02) * 0.2;
        };
        app.ticker.add(pulse);
        
        app.stage.addChild(laser);
        
        // Clean up the pulse effect when laser is removed
        setTimeout(() => {
            app.ticker.remove(pulse);
        }, 150);
        
        // Check for collisions with enemies
        for (let j = enemies.length - 1; j >= 0; j--) {
            const enemy = enemies[j];
            // Check if enemy is within the laser's x-range and above the player
            if (enemy.x < laser.x + (LASER_WIDTH/2 + 4) && 
                enemy.x + enemy.width > laser.x - (LASER_WIDTH/2 + 4) &&
                enemy.y + enemy.height > 0) {  // Only check if enemy is on screen
                createExplosion(
                    enemy.x + enemy.width / 2, 
                    enemy.y + enemy.height / 2,
                    0.15 // Very quiet for laser hits
                );
                app.stage.removeChild(enemy);
                enemies.splice(j, 1);
            }
        }
        
        // Remove laser after a short time
        setTimeout(() => {
            if (laser.parent) {
                app.stage.removeChild(laser);
            }
        }, 150);
        
    } else if (activePowerUp?.powerUpType === PowerUpType.TRIPLE_SHOT) {
        // Create three bullets in a spread
        const angles = [-0.2, 0, 0.2];
        for (const angle of angles) {
            const bullet = new PIXI.Graphics() as IBullet;
            bullet.beginFill(0xffff00);
            bullet.drawRect(0, 0, 3, 10);
            bullet.endFill();
            bullet.x = player.x + playerWidth / 2 - 1.5;
            bullet.y = player.y - 10;
            // Set properties for movement and bouncing
            // Bullets move upward initially with spread
            bullet.angle = angle;
            bullet.dx = Math.sin(angle) * BULLET_SPEED * 1.5; // Horizontal spread
            bullet.dy = -Math.abs(Math.cos(angle) * BULLET_SPEED * 1.5); // Upward movement
            bullet.bounceCount = 0; // Track number of bounces
            bullets.push(bullet);
            app.stage.addChild(bullet);
        }
    } else {
        // Normal bullet
        const bullet = new PIXI.Graphics();
        bullet.beginFill(0x00ff00);
        bullet.drawRect(0, 0, 3, 10);
        bullet.endFill();
        bullet.x = player.x + playerWidth / 2 - 1.5;
        bullet.y = player.y - 10;
        bullets.push(bullet);
        app.stage.addChild(bullet);
    }
    
    // Play shoot sound
    const sound = shootSound.cloneNode() as HTMLAudioElement;
    sound.volume = 0.3;
    sound.play().catch(e => console.log("Shoot sound failed:", e));
    
    // Set cooldown for shooting (except for rapid fire which handles it differently)
    if (activePowerUp?.powerUpType !== PowerUpType.RAPID_FIRE) {
        canShoot = false;
    }
}

// Game loop
app.ticker.add(() => {
    if (gameOver) return;
    
    // Update power-ups
    updatePowerUps();
    
    // Move player
    if (left && player.x > 0) player.x -= PLAYER_SPEED;
    if (right && player.x < app.screen.width - player.width) player.x += PLAYER_SPEED;

    // Shoot bullets
    if (space) shoot();

    // Update bullets
    for (let i = bullets.length - 1; i >= 0; i--) {
        const bullet = bullets[i];
        
        // Handle triple shot bullets with bouncing
        if (bullet.dx !== undefined && bullet.dy !== undefined && bullet.bounceCount !== undefined) {
            // Move bullet
            bullet.x += bullet.dx;
            bullet.y += bullet.dy;
            
            // Bounce off side edges (max 3 bounces)
            if (bullet.x <= 0 || bullet.x >= app.screen.width) {
                bullet.dx *= -1; // Reverse x direction
                bullet.x = Math.max(0, Math.min(bullet.x, app.screen.width)); // Keep in bounds
                bullet.bounceCount++;
            }
            // Let bullets pass through the top of the screen without bouncing
            if (bullet.y <= 0) {
                // Remove the bullet if it goes off the top
                app.stage.removeChild(bullet);
                bullets.splice(i, 1);
                continue;
            }
            
            // Remove after too many bounces or if it goes off bottom
            if (bullet.y > app.screen.height || bullet.bounceCount > 3) {
                app.stage.removeChild(bullet);
                bullets.splice(i, 1);
                continue;
            }
        } 
        // Handle other bullet types
        else {
            // For normal bullets and rapid fire
            bullet.y -= BULLET_SPEED;
            
            // Remove bullets that go off screen
            if (bullet.y < 0 || bullet.y > app.screen.height) {
                app.stage.removeChild(bullet);
                bullets.splice(i, 1);
                continue;
            }
        }

        // Check for collisions with enemies
        for (let j = enemies.length - 1; j >= 0; j--) {
            if (checkCollision(bullets[i], enemies[j])) {
                // Create explosion at enemy position with quieter sound (0.2 volume)
                createExplosion(
                    enemies[j].x + enemies[j].width / 2, 
                    enemies[j].y + enemies[j].height / 2,
                    0.2 // Quieter volume for enemy explosions
                );
                
                // Remove bullet and enemy
                app.stage.removeChild(bullets[i]);
                bullets.splice(i, 1);
                app.stage.removeChild(enemies[j]);
                enemies.splice(j, 1);
                
                break;
            }
        }
    }

    // Randomly drop bombs from enemies
    bombDropTimer++;
    if (bombDropTimer >= BOMB_DROP_INTERVAL / (1 + currentLevel * 0.2) && enemies.length > 0) {
        bombDropTimer = 0;
        const bomber = enemies[Math.floor(Math.random() * enemies.length)];
        dropBomb(bomber.x + bomber.width / 2, bomber.y + bomber.height);
    }

    // Move bombs and check for collisions with player
    for (let i = enemyBombs.length - 1; i >= 0; i--) {
        enemyBombs[i].y += BOMB_SPEED;
        
        // Remove bombs that are off screen
        if (enemyBombs[i].y > app.screen.height) {
            app.stage.removeChild(enemyBombs[i]);
            enemyBombs.splice(i, 1);
            continue;
        }
        
        // Check collision with player
        if (checkCollision(player, enemyBombs[i])) {
            // Create explosion at player's position with full volume (0.3)
            createExplosion(player.x + playerWidth / 2, player.y + playerHeight / 2, 0.3);
            
            // Remove the bomb
            app.stage.removeChild(enemyBombs[i]);
            enemyBombs.splice(i, 1);
            
            // Hide player and wait a moment before respawning or ending game
            player.visible = false;
            
            setTimeout(() => {
                lives--;
                updateUI();
                
                if (lives <= 0) {
                    gameOver = true;
                    gameOverText.visible = true;
                } else {
                    // Reset position if still have lives
                    resetGame(false);
                    player.visible = true;
                }
            }, 500); // Short delay before respawn or game over
            
            return;
        }
    }

    // Move enemies
    let needsToChangeDirection = false;
    enemies.forEach(enemy => {
        enemy.x += enemySpeed * enemy.direction;
        if (enemy.x > app.screen.width - enemy.width || enemy.x < 0) {
            needsToChangeDirection = true;
        }
        
        // Check if enemy reached the bottom or hit the player
        if (enemy.y + enemy.height > player.y) {
            // Game over - enemy reached the bottom
            lives--;
            updateUI();
            
            if (lives <= 0) {
                gameOver = true;
                player.visible = false;
                gameOverText.visible = true;
            } else {
                // Reset position if still have lives
                resetGame();
            }
            return;
        }
        
        // Check collision with player
        if (checkCollision(player, enemy)) {
            lives--;
            updateUI();
            
            if (lives <= 0) {
                gameOver = true;
                player.visible = false;
                gameOverText.visible = true;
            } else {
                // Reset position if still have lives
                resetGame();
            }
            return;
        }
    });

    if (needsToChangeDirection) {
        enemies.forEach(enemy => {
            enemy.direction *= -1;
            enemy.y += 20;
        });
    }
    
    // Check if all enemies are defeated
    if (enemies.length === 0) {
        // Clear any remaining bombs when level is complete
        enemyBombs.forEach(bomb => app.stage.removeChild(bomb));
        enemyBombs = [];
        nextLevel();
    }
});

// Collision detection
function checkCollision(a: PIXI.Graphics, b: PIXI.Graphics): boolean {
    const aBox = a.getBounds();
    const bBox = b.getBounds();
    return aBox.x + aBox.width > bBox.x &&
           aBox.x < bBox.x + bBox.width &&
           aBox.y + aBox.height > bBox.y &&
           aBox.y < bBox.y + bBox.height;
}
