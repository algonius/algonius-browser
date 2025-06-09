# Active Context

## Current Work Focus
**Windows Installation Documentation Fix (COMPLETED)** - Fixed critical Windows registry documentation gap

## Recent Changes
### Windows Installation Manual Uninstallation Fix ✅
- **Problem**: Manual uninstallation section in Windows docs was missing critical registry cleanup
- **Issue**: Instructions only removed manifest files but not Windows registry entries, leaving system in broken state
- **Solution**: Updated `docs/windows-installation.md` with proper registry cleanup commands
- **Critical Fix**: Added registry removal commands:
  - `HKCU:\Software\Google\Chrome\NativeMessagingHosts\ai.algonius.mcp.host`
  - `HKCU:\Software\Microsoft\Edge\NativeMessagingHosts\ai.algonius.mcp.host`
  - `HKCU:\Software\Chromium\NativeMessagingHosts\ai.algonius.mcp.host`

### Technical Implementation Details
- **Registry Cleanup**: Added PowerShell commands to remove registry entries
- **File System Cleanup**: Updated paths to match actual installer structure
- **Directory Structure**: Fixed manifest file location to `%USERPROFILE%\.algonius-browser\manifests\`
- **Complete Coverage**: Manual uninstall now mirrors automatic uninstaller functionality

### Previous Achievements
- **PowerShell Installer**: Complete Windows installation script with registry support
- **Windows Documentation**: Comprehensive `docs/windows-installation.md` guide
- **Cross-Platform Parity**: Windows now matches Linux/macOS installation experience

## Next Steps
Task is complete. Windows installation documentation now properly covers:
1. ✅ Registry-based Windows Native Messaging requirements
2. ✅ Complete manual uninstallation procedures  
3. ✅ Proper directory structure documentation
4. ✅ Registry cleanup commands included

## Active Decisions and Considerations
- **Windows Registry Critical**: Unlike Linux/macOS, Windows Native Messaging REQUIRES registry entries
- **Single Manifest Strategy**: Windows installer uses one manifest file + registry pointers vs multiple manifests
- **Documentation Accuracy**: Manual uninstall must match automatic uninstaller behavior exactly

## Important Patterns and Preferences
- **Windows-Specific Architecture**: Registry-based vs directory-based Native Messaging
- **PowerShell Focus**: All Windows documentation uses PowerShell commands
- **User-Scoped Installation**: No administrator privileges required
- **Multi-Browser Support**: Chrome, Edge, and Chromium automatic detection

## Learnings and Project Insights
- **Platform Differences**: Windows Native Messaging fundamentally different from Linux/macOS
- **Registry Management**: Critical for Windows Native Messaging functionality
- **Documentation Completeness**: Manual procedures must be comprehensive for debugging
- **Cross-Platform Challenges**: Each platform requires specialized knowledge and testing
- **Windows Installer Architecture**: Single manifest + registry pointers is more efficient than multiple manifest copies
