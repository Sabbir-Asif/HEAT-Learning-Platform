import type { PublicFrontPageResponse } from "@heat/contracts";
import { AboutBanner, EmptyState, FeatureGrid, HeroBanner, PageSection } from "@heat/ui";
import {
  AwardIcon,
  BookOpenIcon,
  ClipboardCheckIcon,
  GraduationCapIcon,
  UsersIcon,
} from "lucide-react";
import Image from "next/image";
import { CourseCard } from "./course-card";
import { HeroActions } from "./hero-actions";

interface LandingPageProps {
  frontPage: PublicFrontPageResponse;
}

const features = [
  {
    icon: BookOpenIcon,
    title: "Interactive learning",
    description: "Engaging modules, case studies and real-life scenarios.",
  },
  {
    icon: ClipboardCheckIcon,
    title: "Assess your learning",
    description: "Quizzes, reflections and feedback after every module.",
  },
  {
    icon: AwardIcon,
    title: "Get a certificate",
    description: "Receive a completion certificate when you finish a course.",
  },
  {
    icon: UsersIcon,
    title: "For the university community",
    description: "Designed for students, teachers and administrators.",
  },
];

const aboutFacts = [
  { label: "Project", value: "HEAT sub-project (PIN 13019)" },
  { label: "Implemented by", value: "Department of Women and Gender Studies" },
  { label: "Institution", value: "University of Dhaka" },
  { label: "Audience", value: "Students, teachers and administrators" },
];

export function LandingPage({ frontPage }: LandingPageProps) {
  return (
    <>
      <HeroBanner
        className="-mt-17 pt-17"
        badge="HEAT Project (PIN 13019)"
        title="Preventing gender-based violence in university campuses"
        description="An interactive training for students, teachers and university administrators, from the Women Safety Awareness Program at the University of Dhaka."
        actions={<HeroActions />}
        image={
          <Image
            src="/hero/campus-gathering.jpg"
            alt="Four university students talking together in front of a campus building"
            fill
            priority
            unoptimized
            sizes="100vw"
          />
        }
      />
      <FeatureGrid aria-label="What you get" tiles={features} />
      <PageSection
        id="courses"
        title="Courses"
        description="Enroll in a course to start learning, or pick up where you left off."
      >
        {frontPage.courses.length === 0 ? (
          <EmptyState
            icon={GraduationCapIcon}
            title="No courses yet"
            description="Courses will appear here when they are published."
          />
        ) : (
          <ul className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {frontPage.courses.map((course) => (
              <li key={course.id}>
                <CourseCard course={course} />
              </li>
            ))}
          </ul>
        )}
      </PageSection>
      <AboutBanner
        id="about"
        eyebrow="About the project"
        title="Safer campuses start with awareness"
        image={
          <Image
            src="/hero/campus-illustration.jpg"
            alt="Illustration of a University of Dhaka campus building between trees"
            fill
            unoptimized
            sizes="(min-width: 768px) 50vw, 100vw"
          />
        }
      >
        <p>
          The Women Safety Awareness Program is a HEAT sub-project implemented by the Department of
          Women and Gender Studies, University of Dhaka. It develops a holistic approach to prevent
          gender-based violence in university campuses.
        </p>
        <dl className="mt-2 grid gap-4 sm:grid-cols-2">
          {aboutFacts.map((fact) => (
            <div key={fact.label} className="flex flex-col gap-0.5">
              <dt className="text-xs font-semibold tracking-widest uppercase opacity-70">
                {fact.label}
              </dt>
              <dd className="text-base font-semibold">{fact.value}</dd>
            </div>
          ))}
        </dl>
      </AboutBanner>
    </>
  );
}
