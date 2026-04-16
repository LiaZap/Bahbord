'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

interface Member {
  id: string;
  display_name: string;
  email: string;
}

interface MentionInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export default function MentionInput({
  value,
  onChange,
  onSubmit,
  placeholder,
  className,
  disabled,
}: MentionInputProps) {
  const [members, setMembers] = useState<Member[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [filterText, setFilterText] = useState('');
  const [mentionStart, setMentionStart] = useState<number>(-1);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const membersLoaded = useRef(false);

  // Fetch members once
  useEffect(() => {
    if (membersLoaded.current) return;
    membersLoaded.current = true;
    fetch('/api/options?type=members')
      .then((res) => res.json())
      .then((data) => setMembers(data))
      .catch((err) => console.error('Error fetching members:', err));
  }, []);

  const filtered = members.filter((m) => {
    const q = filterText.toLowerCase();
    return (
      m.display_name.toLowerCase().includes(q) ||
      m.email.toLowerCase().includes(q)
    );
  });

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(e.target as Node)
      ) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const insertMention = useCallback(
    (member: Member) => {
      const before = value.slice(0, mentionStart);
      const after = value.slice(inputRef.current?.selectionStart ?? value.length);
      const newValue = `${before}@${member.display_name} ${after}`;
      onChange(newValue);
      setShowDropdown(false);
      setMentionStart(-1);
      setFilterText('');
      // Focus and set cursor after the inserted mention
      setTimeout(() => {
        if (inputRef.current) {
          const cursorPos = before.length + member.display_name.length + 2; // +2 for @ and space
          inputRef.current.focus();
          inputRef.current.setSelectionRange(cursorPos, cursorPos);
        }
      }, 0);
    },
    [value, mentionStart, onChange]
  );

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const newValue = e.target.value;
    const cursorPos = e.target.selectionStart ?? newValue.length;
    onChange(newValue);

    // Check if we're in a mention context
    const textBeforeCursor = newValue.slice(0, cursorPos);
    const lastAtIndex = textBeforeCursor.lastIndexOf('@');

    if (lastAtIndex >= 0) {
      // Make sure @ is at start or preceded by a space
      const charBefore = lastAtIndex > 0 ? newValue[lastAtIndex - 1] : ' ';
      if (charBefore === ' ' || lastAtIndex === 0) {
        const query = textBeforeCursor.slice(lastAtIndex + 1);
        // No spaces check — allow multi-word names
        if (query.length <= 30) {
          setMentionStart(lastAtIndex);
          setFilterText(query);
          setShowDropdown(true);
          setSelectedIndex(0);
          return;
        }
      }
    }
    setShowDropdown(false);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (showDropdown && filtered.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((i) => (i + 1) % filtered.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((i) => (i - 1 + filtered.length) % filtered.length);
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        insertMention(filtered[selectedIndex]);
        return;
      }
      if (e.key === 'Tab') {
        e.preventDefault();
        insertMention(filtered[selectedIndex]);
        return;
      }
    }

    if (e.key === 'Escape') {
      if (showDropdown) {
        e.preventDefault();
        setShowDropdown(false);
        return;
      }
    }

    if (e.key === 'Enter' && !showDropdown) {
      e.preventDefault();
      onSubmit();
    }
  }

  return (
    <div className="relative">
      <input
        ref={inputRef}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className={className}
        disabled={disabled}
        autoComplete="off"
      />
      {showDropdown && filtered.length > 0 && (
        <div
          ref={dropdownRef}
          className="absolute left-0 top-full z-50 mt-1 max-h-48 w-72 overflow-y-auto rounded-lg border border-white/[0.08] bg-[var(--card-bg)] shadow-xl"
        >
          {filtered.map((member, idx) => (
            <button
              key={member.id}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault(); // prevent blur
                insertMention(member);
              }}
              onMouseEnter={() => setSelectedIndex(idx)}
              className={`flex w-full items-center gap-3 px-3 py-2 text-left transition ${
                idx === selectedIndex
                  ? 'bg-white/[0.08]'
                  : 'hover:bg-white/[0.04]'
              }`}
            >
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-violet-600 text-[10px] font-bold text-white">
                {member.display_name
                  .split(' ')
                  .map((n) => n[0])
                  .join('')
                  .substring(0, 2)
                  .toUpperCase()}
              </div>
              <div className="min-w-0">
                <div className="truncate text-[13px] font-medium text-slate-200">
                  {member.display_name}
                </div>
                <div className="truncate text-[11px] text-slate-500">
                  {member.email}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
