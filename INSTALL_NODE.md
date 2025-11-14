# Node.js Installation Guide (Windows & Mac)

## Windows Installation

### Method 1: Official Installer (Recommended)

1. **Download Node.js:**
   - Go to https://nodejs.org/
   - Click the **LTS** (Long Term Support) button - this downloads the Windows installer
   - The file will be named something like `node-v20.x.x-x64.msi`

2. **Install Node.js:**
   - Double-click the downloaded `.msi` file
   - Click "Next" through the installation wizard
   - Keep all default options checked (this includes npm)
   - Click "Install" (you may need to allow administrator permissions)
   - Click "Finish" when installation completes

3. **Verify Installation:**
   - Open PowerShell or Command Prompt
   - Run these commands:
     ```powershell
     node --version
     npm --version
     ```
   - You should see version numbers (e.g., `v20.11.0` and `10.2.4`)

4. **If commands don't work:**
   - Close and reopen your terminal/IDE
   - This refreshes the PATH environment variable

### Method 2: Using Chocolatey (Windows)

1. **Install Chocolatey first:**
   - Open PowerShell as Administrator (Right-click → Run as Administrator)
   - Run this command:
     ```powershell
     Set-ExecutionPolicy Bypass -Scope Process -Force; [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072; iex ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))
     ```

2. **Install Node.js:**
   ```powershell
   choco install nodejs -y
   ```

3. **Verify:**
   ```powershell
   node --version
   npm --version
   ```

---

## Mac Installation

### Method 1: Official Installer (Recommended)

1. **Download Node.js:**
   - Go to https://nodejs.org/
   - Click the **LTS** (Long Term Support) button - this downloads the Mac installer
   - The file will be named something like `node-v20.x.x.pkg`

2. **Install Node.js:**
   - Double-click the downloaded `.pkg` file
   - Follow the installation wizard
   - Enter your Mac password when prompted
   - Click "Install" and wait for completion

3. **Verify Installation:**
   - Open Terminal
   - Run these commands:
     ```bash
     node --version
     npm --version
     ```
   - You should see version numbers

### Method 2: Using Homebrew (Mac)

1. **Install Homebrew (if not already installed):**
   - Open Terminal
   - Run this command:
     ```bash
     /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
     ```
   - Follow the prompts and enter your password

2. **Install Node.js:**
   ```bash
   brew install node
   ```

3. **Verify:**
   ```bash
   node --version
   npm --version
   ```

---

## After Installation (Both Platforms)

1. **Navigate to your project directory:**
   ```bash
   # Windows PowerShell
   cd "C:\Users\Owner\OneDrive\Documents\2025 Fall\Hackathon\Blockly"
   
   # Mac Terminal
   cd ~/path/to/Blockly
   ```

2. **Install project dependencies:**
   ```bash
   npm install
   ```

3. **Verify installation worked:**
   - Check that `node_modules` folder was created
   - TypeScript errors in your IDE should disappear

---

## Troubleshooting

### "node is not recognized" / "command not found"
- **Windows:** Close and reopen your terminal/IDE
- **Mac:** Close and reopen Terminal, or run `source ~/.zshrc` (or `source ~/.bash_profile`)

### Permission Errors
- **Windows:** Run terminal as Administrator
- **Mac:** Use `sudo` if needed, but Homebrew usually doesn't require it

### Still having issues?
- Visit https://nodejs.org/ and download the installer directly
- Make sure you download the LTS version (not Current)
- Restart your computer after installation if problems persist

