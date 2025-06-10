# Active Context

## Current Work Focus
**GitHub Issue Templates Branding Fix (COMPLETED)** - Fixed branding inconsistencies across all GitHub issue templates

## Recent Changes
### GitHub Issue Templates Branding Update ✅
- **Problem**: Issue templates contained inconsistent branding references to "NanoBrowser" and "Nanobrowser" instead of "Algonius Browser"
- **Issue**: Templates referenced wrong repository URLs and used outdated project names
- **Solution**: Updated all GitHub issue templates to use consistent "Algonius Browser" branding
- **Files Updated**:
  - `.github/ISSUE_TEMPLATE/bug_report.yml` - Fixed project name, updated form fields for MCP architecture
  - `.github/ISSUE_TEMPLATE/feature_request.yml` - Updated project name and description
  - `.github/ISSUE_TEMPLATE/docs.yml` - Added project name for clarity
  - `.github/ISSUE_TEMPLATE/config.yml` - Fixed repository URLs and added Discord community link

### Technical Implementation Details
- **Bug Report Template**: Replaced LLM-focused fields with MCP component fields (Chrome Extension, MCP Host, Browser Automation Tools)
- **Repository URLs**: Updated from `nanobrowser/nanobrowser` to `algonius/algonius-browser`
- **Version Examples**: Updated from "0.1.0" to current "0.4.11" format
- **Community Links**: Added Discord community link alongside GitHub Discussions
- **Form Fields**: Modernized bug report to reflect MCP architecture rather than multi-agent system

### Previous Achievements
- **Windows Installation Documentation Fix**: Fixed critical Windows registry documentation gap
- **PowerShell Installer**: Complete Windows installation script with registry support
- **Cross-Platform Parity**: Windows now matches Linux/macOS installation experience

## Next Steps
GitHub branding consistency is now complete across all issue templates:
1. ✅ Bug report template updated with correct project name and MCP-focused fields
2. ✅ Feature request template uses consistent "Algonius Browser" branding
3. ✅ Documentation template includes project name clarity
4. ✅ Config file points to correct repository and includes Discord community

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
