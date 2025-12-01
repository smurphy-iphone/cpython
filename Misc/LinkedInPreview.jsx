import React from 'react';
import { motion } from 'framer-motion';
import { X, Linkedin, MapPin, Users, Copy, Check, Download } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export default function LinkedInPreview({
  headline = '',
  about = '',
  experiences = [],
  onClose,
  profilePhoto,
}) {
  const [copied, setCopied] = React.useState(null);

  const groupedExperiences = React.useMemo(() => {
    return experiences.reduce((acc, exp) => {
      const key = `${exp.title}|${exp.company}`;
      if (!acc[key]) acc[key] = { title: exp.title, company: exp.company, bullets: [] };
      acc[key].bullets.push(exp.bullet);
      return acc;
    }, {});
  }, [experiences]);

  const handleCopy = async (text, section) => {
    try {
      if (!navigator?.clipboard?.writeText) {
        throw new Error('Clipboard API unavailable');
      }
      await navigator.clipboard.writeText(text);
      setCopied(section);
      toast.success('Copied to clipboard!');
    } catch (error) {
      console.error('Clipboard copy failed:', error);
      toast.error('Unable to copy. Please try again.');
    } finally {
      setTimeout(() => setCopied(null), 2000);
    }
  };

  const buildCopyAllText = () => {
    let fullText = '';

    if (headline) fullText += `HEADLINE:\n${headline}\n\n`;
    if (about) fullText += `ABOUT:\n${about}\n\n`;

    if (experiences.length) {
      fullText += `EXPERIENCE BULLETS:\n`;
      Object.values(groupedExperiences).forEach((role) => {
        fullText += `\n${role.title} at ${role.company}:\n`;
        role.bullets.forEach((bullet) => {
          fullText += `• ${bullet}\n`;
        });
      });
    }

    return fullText.trim();
  };

  const copyAll = async () => {
    const fullText = buildCopyAllText();

    if (!fullText) {
      toast.info('No content to copy yet.');
      return;
    }

    await handleCopy(fullText, 'all');
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col"
      >
        <div className="flex items-center justify-between p-6 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#0A66C2] flex items-center justify-center">
              <Linkedin className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="font-semibold text-slate-800">Profile Preview</h2>
              <p className="text-xs text-slate-500">Your generated LinkedIn content</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={copyAll}
              className="text-slate-600"
            >
              <Download className="w-4 h-4 mr-2" />
              Copy All
            </Button>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="w-5 h-5" />
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="bg-gradient-to-br from-slate-50 to-blue-50/30 p-6">
            <div className="bg-white rounded-xl shadow-lg overflow-hidden">
              <div className="h-24 bg-gradient-to-r from-[#0A66C2] to-blue-600" />
              <div className="px-6 pb-6">
                <div className="relative -mt-12 mb-4">
                  {profilePhoto ? (
                    <img 
                      src={profilePhoto} 
                      alt="Profile" 
                      className="w-24 h-24 rounded-full border-4 border-white object-cover shadow-lg"
                    />
                  ) : (
                    <div className="w-24 h-24 rounded-full bg-slate-200 border-4 border-white flex items-center justify-center">
                      <span className="text-3xl font-bold text-slate-400">?</span>
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <h3 className="text-xl font-bold text-slate-900">Your Name</h3>
                  {headline ? (
                    <div className="group relative">
                      <p className="text-slate-600 pr-8">{headline}</p>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleCopy(headline, 'headline')}
                        className="absolute right-0 top-0 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        {copied === 'headline' ? (
                          <Check className="w-4 h-4 text-green-500" />
                        ) : (
                          <Copy className="w-4 h-4 text-slate-400" />
                        )}
                      </Button>
                    </div>
                  ) : (
                    <p className="text-slate-400 italic">No headline selected</p>
                  )}

                  <div className="flex items-center gap-4 text-sm text-slate-500 pt-2">
                    <span className="flex items-center gap-1">
                      <MapPin className="w-4 h-4" />
                      Location
                    </span>
                    <span className="flex items-center gap-1">
                      <Users className="w-4 h-4" />
                      500+ connections
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="p-6 border-b border-slate-100">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-slate-800">About</h3>
              {about && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleCopy(about, 'about')}
                  className="text-slate-400 hover:text-slate-600"
                >
                  {copied === 'about' ? (
                    <Check className="w-4 h-4 text-green-500" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </Button>
              )}
            </div>
            {about ? (
              <p className="text-slate-600 whitespace-pre-line leading-relaxed">{about}</p>
            ) : (
              <p className="text-slate-400 italic">No about section selected</p>
            )}
          </div>

          <div className="p-6">
            <h3 className="font-semibold text-slate-800 mb-4">Experience</h3>
            {experiences.length ? (
              <div className="space-y-6">
                {Object.entries(groupedExperiences).map(([key, role]) => (
                  <div key={key} className="flex gap-4">
                    <div className="w-12 h-12 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
                      <span className="text-lg font-bold text-slate-400">
                        {role.company.charAt(0)}
                      </span>
                    </div>
                    <div className="flex-1">
                      <h4 className="font-semibold text-slate-800">{role.title}</h4>
                      <p className="text-sm text-slate-500 mb-2">{role.company}</p>
                      <ul className="space-y-1.5">
                        {role.bullets.map((bullet, idx) => (
                          <li key={idx} className="text-sm text-slate-600">
                            • {bullet}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-slate-400 italic">No experience bullets selected</p>
            )}
          </div>
        </div>

        <div className="p-6 border-t border-slate-100 bg-slate-50">
          <p className="text-sm text-slate-500 text-center">
            Copy individual sections or use "Copy All" to get everything at once
          </p>
        </div>
      </motion.div>
    </motion.div>
  );
}
