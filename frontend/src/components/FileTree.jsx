import React, { useState, useMemo } from 'react';
import { minimatch } from 'minimatch';
import { Folder, FolderOpen, File, CheckCircle2, XCircle, PlusCircle, MinusCircle } from 'lucide-react';

// Build a hierarchical tree from flat GitLab paths
const buildTree = (paths) => {
  const root = {};
  paths.forEach(item => {
    const parts = item.path.split('/');
    let current = root;
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      if (!current[part]) {
        current[part] = {
          name: part,
          path: parts.slice(0, i + 1).join('/'),
          type: i === parts.length - 1 ? item.type : 'tree',
          children: {}
        };
      }
      current = current[part].children;
    }
  });
  return root;
};

// Evaluate if a path matches the globs
const isMatch = (path, includeStr, excludeStr) => {
  const includes = includeStr.split(',').map(p => p.trim()).filter(Boolean);
  const excludes = excludeStr.split(',').map(p => p.trim()).filter(Boolean);

  const matchesPattern = (pathStr, pattern) => {
    return minimatch(pathStr, pattern, { matchBase: true, dot: true }) || 
           minimatch(pathStr, pattern + '/**', { matchBase: true, dot: true });
  };

  let isIncluded = includes.length === 0 ? true : false;
  for (const pattern of includes) {
    if (matchesPattern(path, pattern)) {
      isIncluded = true;
      break;
    }
  }

  let isExcluded = false;
  for (const pattern of excludes) {
    if (matchesPattern(path, pattern)) {
      isExcluded = true;
      break;
    }
  }

  return isIncluded && !isExcluded;
};

const TreeNode = ({ node, includedPatterns, excludedPatterns, level = 0, onAddInclude, onAddExclude, isAncestorIncluded = false, disableActions = false }) => {
  const [isOpen, setIsOpen] = useState(level < 1); // auto open root levels

  const isFolder = node.type === 'tree';
  const matches = !isFolder ? isMatch(node.path, includedPatterns, excludedPatterns) : null;
  const isIncluded = isFolder ? false : matches;
  const isExcluded = isFolder ? false : !matches;
  
  const extMatch = !isFolder ? node.name.match(/\.([^.]+)$/) : null;
  const ext = extMatch ? extMatch[1] : null;
  
  const isFolderExcluded = isFolder ? excludedPatterns.split(',').map(p => p.trim()).filter(Boolean).some(pattern => 
    minimatch(node.path, pattern, { matchBase: true, dot: true }) || 
    minimatch(node.path, pattern + '/**', { matchBase: true, dot: true })
  ) : false;

  return (
    <div className="select-none group/node">
      <div 
        className={`flex items-center gap-1.5 py-1 px-2 rounded-md hover:bg-bgHover cursor-pointer text-[13px] font-mono`}
        style={{ paddingLeft: `${level * 16 + 8}px` }}
        onClick={() => isFolder && setIsOpen(!isOpen)}
      >
        {isFolder ? (
          <span className="text-blue-400 shrink-0">
            {isOpen ? <FolderOpen size={14} /> : <Folder size={14} />}
          </span>
        ) : (
          <File size={13} className="text-textMuted shrink-0 ml-0.5" />
        )}
        
        <span className={`truncate ${isFolder ? (isFolderExcluded ? 'font-medium text-textMuted/40 line-through' : 'font-medium text-textMain') : matches ? 'text-green-500' : 'text-textMuted/40 line-through'}`}>
          {node.name}
        </span>
        
        <span className="ml-auto shrink-0 flex items-center gap-2">
          {!disableActions && (
            <div className="hidden group-hover/node:flex items-center gap-1 mr-2">
              {ext && (
                <>
                  <button 
                    type="button" 
                    onClick={(e) => { e.stopPropagation(); onAddInclude(`**/*.${ext}`); }}
                    className="text-[10px] font-bold bg-green-500/10 text-green-600 px-1.5 py-0.5 rounded hover:bg-green-500 hover:text-white transition-colors"
                    title={`Include all *.${ext} files`}
                  >
                    +*.{ext}
                  </button>
                  <button 
                    type="button" 
                    onClick={(e) => { e.stopPropagation(); onAddExclude(`**/*.${ext}`); }}
                    className="text-[10px] font-bold bg-red-400/10 text-red-500 px-1.5 py-0.5 rounded hover:bg-red-500 hover:text-white transition-colors"
                    title={`Exclude all *.${ext} files`}
                  >
                    -*.{ext}
                  </button>
                  <div className="w-px h-3 bg-borderColor mx-0.5" />
                </>
              )}
              <button 
                type="button" 
                onClick={(e) => { e.stopPropagation(); onAddInclude(isFolder ? `**/${node.path}` : node.path); }}
                className="text-green-500 hover:bg-green-500/20 p-0.5 rounded-md transition-colors"
                title="Add exact path to Included Patterns"
              >
                <PlusCircle size={14} />
              </button>
              <button 
                type="button" 
                onClick={(e) => { e.stopPropagation(); onAddExclude(isFolder ? `**/${node.path}` : node.path); }}
                className="text-red-400 hover:bg-red-400/20 p-0.5 rounded-md transition-colors"
                title="Add exact path to Excluded Patterns"
              >
                <MinusCircle size={14} />
              </button>
            </div>
          )}
          {!isFolder && (
            matches ? <CheckCircle2 size={13} className="text-green-500" /> : <XCircle size={13} className="text-red-400/40" />
          )}
        </span>
      </div>
      
      {isFolder && isOpen && (
        <div>
          {Object.values(node.children)
            .sort((a, b) => {
              if (a.type === b.type) return a.name.localeCompare(b.name);
              return a.type === 'tree' ? -1 : 1; // folders first
            })
            .map(child => (
            <TreeNode 
              key={child.path} 
              node={child} 
              level={level + 1} 
              includedPatterns={includedPatterns}
              excludedPatterns={excludedPatterns}
              isAncestorIncluded={isAncestorIncluded || isIncluded}
              onAddInclude={onAddInclude}
              onAddExclude={onAddExclude}
              disableActions={disableActions}
            />
          ))}
        </div>
      )}
    </div>
  );
};

const FileTree = ({ items, includedPatterns, excludedPatterns, onAddInclude, onAddExclude, disableActions = false }) => {
  const tree = useMemo(() => buildTree(items), [items]);

  if (!items || items.length === 0) {
    return (
      <div className="text-sm text-textMuted p-6 text-center border border-dashed border-borderColor rounded-md bg-bgPanel">
        No files to display. Fetch the tree to preview patterns.
      </div>
    );
  }

  return (
    <div className="bg-bgMain border border-borderColor rounded-md overflow-y-auto h-full py-2 shadow-inner">
      {Object.values(tree)
        .sort((a, b) => {
          if (a.type === b.type) return a.name.localeCompare(b.name);
          return a.type === 'tree' ? -1 : 1;
        })
        .map(node => (
        <TreeNode 
          key={node.path} 
          node={node} 
          includedPatterns={includedPatterns}
          excludedPatterns={excludedPatterns}
          onAddInclude={onAddInclude}
          onAddExclude={onAddExclude}
          disableActions={disableActions}
        />
      ))}
    </div>
  );
};

export default FileTree;
